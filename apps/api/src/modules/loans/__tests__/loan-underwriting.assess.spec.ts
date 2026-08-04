import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
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
  arrears = 0,
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
    arrearsCount: vi.fn().mockResolvedValue(arrears),
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

/** The offer minted beside an approval, asserted apart from the decision that priced it. */
function expectMintedOffer(
  application: LoanApplicationDoc,
  amountMinorUnits: number,
  rate: number | null | undefined,
): void {
  expect(application.offer).not.toBeNull();
  expect(application.offer?.amountMinorUnits).toBe(amountMinorUnits);
  expect(application.offer?.rate).toBe(rate);
  expect(application.offer?.instalmentMinorUnits).toBeGreaterThan(0);
  expect(application.offer?.expiresAt).toEqual(new Date(NOW.getTime() + OFFER_TTL_MS));
  expect(application.offer?.acceptedAt).toBeNull();
}

describe('LoanUnderwritingService.assess', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('approves a strong application, booking a priced offer that expires in 30 days', async () => {
    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('offered');
    expect(updated.decision?.outcome).toBe('approved');
    expect(updated.decision?.decidedBy).toBe('scorecard');
    expect(updated.decision?.decidedAt).toBe(NOW.toISOString());
    expect(updated.decision?.approvedAmount).toEqual({
      minorUnits: 1_000_000,
      currency: 'USD',
      scale: 2,
    });
    expect(updated.decision?.approvedRate).not.toBeNull();
    expect(updated.decision?.reasons[0]).toMatch(/against our lending policy/);

    expectMintedOffer(updated, 1_000_000, updated.decision?.approvedRate);
  });

  it('persists the decision, offer and status from the frozen clock', async () => {
    const updated = await context.service.assess('app-1', 'scorecard');

    expect(context.repository.profile).toHaveBeenCalledWith('cust-1');
    expect(context.repository.arrearsCount).toHaveBeenCalledWith('cust-1');
    expect(context.applications.updateOne).toHaveBeenCalledWith(
      { _id: 'app-1' },
      {
        $set: {
          decision: updated.decision,
          offer: updated.offer,
          status: 'offered',
          updatedAt: NOW,
        },
      },
    );
  });

  it('declines a request below the product amount band and clears any offer', async () => {
    context = setup(applicationDoc({ requestedMinorUnits: 50_000 }));

    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('declined');
    expect(updated.decision?.outcome).toBe('declined');
    expect(updated.decision?.approvedAmount).toBeNull();
    expect(updated.decision?.approvedRate).toBeNull();
    expect(updated.decision?.reasons[0]).toMatch(/The smallest Personal Loan we offer/);
    expect(updated.offer).toBeNull();
  });

  it('declines a weak score even when every policy rule passes', async () => {
    context = setup(
      applicationDoc({
        requestedMinorUnits: 400_000,
        termMonths: 84,
        declaredMonthlyIncomeMinorUnits: 200_000,
        declaredMonthlyExpensesMinorUnits: 60_000,
        existingCommitmentsMinorUnits: 75_000,
      }),
      { tier: 'standard', kycLevel: null, kycVerified: false },
    );

    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('declined');
    expect(updated.decision?.outcome).toBe('declined');
    expect(updated.decision?.reasons[0]).toMatch(/below the minimum of 560/);
    expect(updated.offer).toBeNull();
  });

  it('refers a mid-band score to an underwriter with no rule reasons', async () => {
    context = setup(
      applicationDoc({
        requestedMinorUnits: 1_500_000,
        termMonths: 36,
        declaredMonthlyIncomeMinorUnits: 300_000,
        declaredMonthlyExpensesMinorUnits: 150_000,
        existingCommitmentsMinorUnits: 30_000,
      }),
      { tier: 'standard', kycLevel: 'tier_3', kycVerified: true },
    );

    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('under_review');
    expect(updated.decision?.outcome).toBe('referred');
    expect(updated.decision?.approvedAmount).toBeNull();
    expect(updated.decision?.reasons[0]).toMatch(/just below automatic approval/);
    expect(updated.offer).toBeNull();
  });

  it('refers a strong applicant who already has a loan in arrears', async () => {
    context = setup(applicationDoc(), VERIFIED_PREMIER, 1);

    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('under_review');
    expect(updated.decision?.reasons).toEqual([
      "1 existing loan(s) in arrears need an underwriter's review",
    ]);
  });

  it('refers a strong applicant whose identity is not verified', async () => {
    context = setup(applicationDoc(), { tier: 'premier', kycLevel: 'tier_1', kycVerified: false });

    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('under_review');
    expect(updated.decision?.reasons).toEqual([
      'Identity verification must be completed before drawdown',
    ]);
  });

  it('declines when declared income is zero, reporting repayments as all of income', async () => {
    context = setup(
      applicationDoc({
        declaredMonthlyIncomeMinorUnits: 0,
        declaredMonthlyExpensesMinorUnits: 50_000,
        existingCommitmentsMinorUnits: 10_000,
      }),
    );

    const updated = await context.service.assess('app-1', 'scorecard');

    expect(updated.status).toBe('declined');
    expect(updated.decision?.reasons.join(' ')).toMatch(/take all of declared monthly income/);
    expect(updated.decision?.reasons.join(' ')).toMatch(/does not cover existing outgoings/);
  });

  it('propagates NotFoundError when the application does not exist', async () => {
    context = setup(null);

    await expect(context.service.assess('app-1', 'scorecard')).rejects.toThrow(NotFoundError);
    expect(context.applications.updateOne).not.toHaveBeenCalled();
  });

  it('propagates NotFoundError for an unknown product code', async () => {
    context = setup(applicationDoc({ productCode: 'NOPE', productName: 'Nope' }));

    await expect(context.service.assess('app-1', 'scorecard')).rejects.toThrow(NotFoundError);
    expect(context.applications.updateOne).not.toHaveBeenCalled();
  });
});
