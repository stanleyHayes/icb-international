import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { StaffLoanDecisionRequest } from '../domain/staff-decision.request.js';
import type { LoanApplicationDoc } from '../infrastructure/loan-application.schemas.js';
import {
  type LoansRepository,
  type CustomerProfile,
} from '../infrastructure/loans.repository.js';
import { LoanUnderwritingService } from '../loan-underwriting.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const OFFER_TTL_MS = 30 * 86_400_000;

const VERIFIED_PREMIER: CustomerProfile = {
  tier: 'premier',
  kycLevel: 'tier_3',
  kycVerified: true,
};

/** A file the scorecard declines on score alone: policy rules pass, but the score is ~525. */
const WEAK_DOC: Partial<LoanApplicationDoc> = {
  requestedMinorUnits: 400_000,
  termMonths: 84,
  declaredMonthlyIncomeMinorUnits: 200_000,
  declaredMonthlyExpensesMinorUnits: 60_000,
  existingCommitmentsMinorUnits: 75_000,
};

const WEAK_PROFILE: CustomerProfile = {
  tier: 'standard',
  kycLevel: null,
  kycVerified: false,
};

function applicationDoc(overrides: Partial<LoanApplicationDoc> = {}): LoanApplicationDoc {
  return {
    _id: 'app-1',
    reference: 'LNA-TEST',
    customerId: 'cust-1',
    productCode: 'PERSONAL_STANDARD',
    productName: 'Personal Loan',
    status: 'submitted',
    requestedMinorUnits: 1_000_000,
    currency: 'USD',
    termMonths: 12,
    frequency: 'monthly',
    purpose: 'home_improvement',
    purposeDetail: null,
    disbursementAccountId: 'acct-1',
    repaymentAccountId: 'acct-1',
    declaredMonthlyIncomeMinorUnits: 500_000,
    declaredMonthlyExpensesMinorUnits: 100_000,
    existingCommitmentsMinorUnits: 0,
    documents: [],
    decision: null,
    offer: null,
    loanId: null,
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup(
  doc: LoanApplicationDoc | null = applicationDoc(),
  profile: CustomerProfile = VERIFIED_PREMIER,
) {
  const applications = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const repository = {
    requireApplication: vi.fn().mockImplementation(() => {
      if (!doc) {
        return Promise.reject(new NotFoundError('Loan application', 'app-1'));
      }
      return Promise.resolve(doc);
    }),
    profile: vi.fn().mockResolvedValue(profile),
    arrearsCount: vi.fn().mockResolvedValue(0),
    applications,
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoanUnderwritingService(
    repository as unknown as LoansRepository,
    clock,
  );
  return { service, repository, applications };
}

/** The offer minted beside an approval, asserted apart from the decision the underwriter set. */
function expectMintedOffer(
  application: LoanApplicationDoc,
  amountMinorUnits: number,
  rate: number,
): void {
  expect(application.offer?.amountMinorUnits).toBe(amountMinorUnits);
  expect(application.offer?.rate).toBe(rate);
  expect(application.offer?.instalmentMinorUnits).toBeGreaterThan(0);
  expect(application.offer?.expiresAt).toEqual(new Date(NOW.getTime() + OFFER_TTL_MS));
}

describe('LoanUnderwritingService.override', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('refuses to decide an application that is no longer open', async () => {
    for (const status of ['declined', 'disbursed', 'withdrawn']) {
      context = setup(applicationDoc({ status }));

      await expect(
        context.service.override('app-1', 'staff-1', { outcome: 'approved' }),
      ).rejects.toThrow(ConflictError);
      expect(context.applications.updateOne).not.toHaveBeenCalled();
    }
  });

  it('approves a scorecard decline at the amount, rate and reasons the underwriter set', async () => {
    context = setup(applicationDoc(WEAK_DOC), WEAK_PROFILE);
    const request: StaffLoanDecisionRequest = {
      outcome: 'approved',
      approvedAmount: { minorUnits: 300_000, currency: 'USD', scale: 2 },
      approvedRate: 12.5,
      reasons: ['Manual review of bank statements supports the request'],
    };

    const updated = await context.service.override('app-1', 'staff-1', request);

    expect(updated.status).toBe('offered');
    expect(updated.decision?.outcome).toBe('approved');
    expect(updated.decision?.approvedAmount).toEqual({
      minorUnits: 300_000,
      currency: 'USD',
      scale: 2,
    });
    expect(updated.decision?.approvedRate).toBe(12.5);
    expect(updated.decision?.reasons).toEqual([
      'Manual review of bank statements supports the request',
    ]);
    expect(updated.decision?.decidedBy).toBe('staff-1');
    expect(updated.decision?.score).toBeGreaterThan(0);
    expect(updated.decision?.factors).toHaveLength(7);

    expectMintedOffer(updated, 300_000, 12.5);
  });

  it('falls back to the requested principal and a scored rate when the override gives neither', async () => {
    context = setup(applicationDoc(WEAK_DOC), WEAK_PROFILE);

    const updated = await context.service.override('app-1', 'staff-1', { outcome: 'approved' });

    expect(updated.status).toBe('offered');
    expect(updated.decision?.approvedAmount).toEqual({
      minorUnits: 400_000,
      currency: 'USD',
      scale: 2,
    });
    expect(updated.decision?.approvedRate).toBeGreaterThanOrEqual(7.9);
    expect(updated.decision?.approvedRate).toBeLessThanOrEqual(19.9);
    expect(updated.decision?.reasons[0]).toMatch(/below the minimum of 560/);
    expect(updated.offer?.amountMinorUnits).toBe(400_000);
  });

  it('declines an otherwise approvable application, keeping the machine reasons', async () => {
    const updated = await context.service.override('app-1', 'staff-1', { outcome: 'declined' });

    expect(updated.status).toBe('declined');
    expect(updated.decision?.outcome).toBe('declined');
    expect(updated.decision?.approvedAmount).toBeNull();
    expect(updated.decision?.approvedRate).toBeNull();
    expect(updated.decision?.reasons[0]).toMatch(/against our lending policy/);
    expect(updated.offer).toBeNull();

    expect(context.applications.updateOne).toHaveBeenCalledWith(
      { _id: 'app-1' },
      {
        $set: {
          decision: updated.decision,
          offer: null,
          status: 'declined',
          updatedAt: NOW,
        },
      },
    );
  });

  it('refers an otherwise approvable application back to the review queue', async () => {
    const updated = await context.service.override('app-1', 'staff-1', { outcome: 'referred' });

    expect(updated.status).toBe('under_review');
    expect(updated.decision?.outcome).toBe('referred');
    expect(updated.decision?.approvedAmount).toBeNull();
    expect(updated.decision?.approvedRate).toBeNull();
    expect(updated.offer).toBeNull();
  });
});
