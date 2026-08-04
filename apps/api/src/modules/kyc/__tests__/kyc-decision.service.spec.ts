import type { KycDecisionRequest } from '@icb/contracts';
import type { ClientSession, Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { KycCaseDoc, KycDecisionSub } from '../infrastructure/kyc.schemas.js';
import { type DecisionActor, KycDecisionService } from '../application/kyc-decision.service.js';
import { CASE_ID, CUSTOMER_ID, NOW, chainQuery, kycCaseDoc } from './fixtures.js';

const SESSION = {} as ClientSession;
const ACTOR: DecisionActor = { id: 'staff-1', label: 'Grace Hopper' };
const APPROVE: KycDecisionRequest = { outcome: 'approved', reason: 'Evidence verified' };

function decidedSub(outcome: KycDecisionRequest['outcome'] = 'approved'): KycDecisionSub {
  return { outcome, grantedLevel: 'tier_2', reason: 'Done', decidedBy: 'ops-1', decidedAt: NOW };
}

function setup(existing: KycCaseDoc | null, updated?: KycCaseDoc | null) {
  const cases = {
    findById: vi.fn().mockReturnValue(chainQuery(existing)),
    findOneAndUpdate: vi.fn().mockReturnValue(
      chainQuery(updated === undefined ? existing : updated),
    ),
  };
  const customers = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const transactionManager = {
    withTransaction: vi
      .fn()
      .mockImplementation((work: (session: ClientSession) => Promise<KycCaseDoc>) =>
        work(SESSION),
      ),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new KycDecisionService(
    cases as unknown as Model<KycCaseDoc>,
    customers as unknown as Model<CustomerDoc>,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, cases, customers, transactionManager };
}

function caseSetOn(cases: ReturnType<typeof setup>['cases']): Record<string, unknown> {
  const update = (cases.findOneAndUpdate.mock.calls[0] as unknown[])[1] as {
    $set: Record<string, unknown>;
  };
  return update.$set;
}

function customerSetOn(customers: ReturnType<typeof setup>['customers']): Record<string, unknown> {
  const update = (customers.updateOne.mock.calls[0] as unknown[])[1] as {
    $set: Record<string, unknown>;
  };
  return update.$set;
}

describe('KycDecisionService.decide guards', () => {
  it('rejects an unknown case before any write', async () => {
    const { service, cases, customers } = setup(null);

    await expect(service.decide(CASE_ID, ACTOR, APPROVE)).rejects.toThrow(NotFoundError);
    expect(cases.findOneAndUpdate).not.toHaveBeenCalled();
    expect(customers.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to decide a case that already carries a decision', async () => {
    const { service, cases } = setup(
      kycCaseDoc({ status: 'approved', decision: decidedSub() }),
    );

    await expect(service.decide(CASE_ID, ACTOR, APPROVE)).rejects.toThrow(ConflictError);
    expect(cases.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses to decide a case that was never submitted', async () => {
    const { service, cases } = setup(kycCaseDoc({ status: 'in_progress' }));

    await expect(service.decide(CASE_ID, ACTOR, APPROVE)).rejects.toThrow(ConflictError);
    expect(cases.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('KycDecisionService.decide approval', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(
      kycCaseDoc({
        status: 'pending_review',
        requestedLevel: 'tier_2',
        riskRating: 'medium',
      }),
      kycCaseDoc({
        status: 'approved',
        requestedLevel: 'tier_2',
        riskRating: 'medium',
        decision: decidedSub(),
      }),
    );
  });

  it('writes the decision, the approved status, and the inherited risk rating in one transaction', async () => {
    const result = await deps.service.decide(CASE_ID, ACTOR, APPROVE);

    expect(deps.transactionManager.withTransaction).toHaveBeenCalledTimes(1);
    const set = caseSetOn(deps.cases);
    expect(set['status']).toBe('approved');
    expect(set['riskRating']).toBe('medium');
    expect(set['updatedAt']).toEqual(NOW);
    expect(set['decision']).toEqual({
      outcome: 'approved',
      grantedLevel: 'tier_2',
      reason: 'Evidence verified',
      decidedBy: 'Grace Hopper',
      decidedAt: NOW,
    });
    // The session threads through both writes so case and customer commit together.
    const options = (deps.cases.findOneAndUpdate.mock.calls[0] as unknown[])[2];
    expect(options).toEqual({ new: true, session: SESSION });
    expect(result.status).toBe('approved');
  });

  it('lands the granted tier and a one-year review date on the customer record', async () => {
    await deps.service.decide(CASE_ID, ACTOR, APPROVE);

    expect(deps.customers.updateOne).toHaveBeenCalledWith(
      { _id: CUSTOMER_ID },
      {
        $set: {
          kycStatus: 'approved',
          riskRating: 'medium',
          kycLevel: 'tier_2',
          kycVerifiedAt: NOW,
          kycNextReviewAt: new Date('2027-08-04T10:00:00.000Z'),
        },
      },
      { session: SESSION },
    );
  });

  it('honours a lower granted tier than the one applied for', async () => {
    await deps.service.decide(CASE_ID, ACTOR, { ...APPROVE, grantedLevel: 'tier_1' });

    expect(caseSetOn(deps.cases)['decision']).toMatchObject({ grantedLevel: 'tier_1' });
    expect(customerSetOn(deps.customers)['kycLevel']).toBe('tier_1');
  });

  it('lets staff override the derived risk rating', async () => {
    await deps.service.decide(CASE_ID, ACTOR, { ...APPROVE, riskRating: 'low' });

    expect(caseSetOn(deps.cases)['riskRating']).toBe('low');
    expect(customerSetOn(deps.customers)['riskRating']).toBe('low');
  });

  it('omits the risk rating from the customer write when nothing is known', async () => {
    const { service, cases, customers } = setup(
      kycCaseDoc({ status: 'pending_review', riskRating: null }),
    );

    await service.decide(CASE_ID, ACTOR, APPROVE);

    expect(caseSetOn(cases)['riskRating']).toBeNull();
    expect(customerSetOn(customers)).not.toHaveProperty('riskRating');
  });
});

describe('KycDecisionService.decide non-approval', () => {
  it('rejects without touching the stored tier', async () => {
    const { service, cases, customers } = setup(
      kycCaseDoc({ status: 'pending_review', riskRating: 'high' }),
    );

    await service.decide(CASE_ID, ACTOR, { outcome: 'rejected', reason: 'Watchlist match' });

    expect(caseSetOn(cases)['status']).toBe('rejected');
    expect(caseSetOn(cases)['decision']).toMatchObject({ outcome: 'rejected', grantedLevel: null });
    expect(customerSetOn(customers)).toEqual({ kycStatus: 'rejected', riskRating: 'high' });
  });

  it('sends the case back for more information with no tier change', async () => {
    const { service, cases, customers } = setup(
      kycCaseDoc({ status: 'pending_review', riskRating: null }),
    );

    await service.decide(CASE_ID, ACTOR, {
      outcome: 'more_info_required',
      reason: 'Utility bill is unreadable',
    });

    expect(caseSetOn(cases)['status']).toBe('more_info_required');
    expect(customerSetOn(customers)).toEqual({ kycStatus: 'more_info_required' });
  });
});

describe('KycDecisionService.decide write failures', () => {
  it('propagates the typed not-found when the case vanishes mid-transaction', async () => {
    const { service, customers } = setup(kycCaseDoc({ status: 'pending_review' }), null);

    await expect(service.decide(CASE_ID, ACTOR, APPROVE)).rejects.toThrow(NotFoundError);
    expect(customers.updateOne).not.toHaveBeenCalled();
  });

  it('propagates the typed not-found when the customer is gone', async () => {
    const { service, customers } = setup(kycCaseDoc({ status: 'pending_review' }));
    customers.updateOne.mockResolvedValue({ matchedCount: 0 });

    await expect(service.decide(CASE_ID, ACTOR, APPROVE)).rejects.toThrow(NotFoundError);
  });
});
