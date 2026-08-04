import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type AccountsService } from '../../accounts/accounts.service.js';
import { type LedgerService } from '../../ledger/ledger.service.js';
import type {
  SavingsContributionDoc,
  SavingsGoalDoc,
} from '../infrastructure/savings-goal.schemas.js';
import { SavingsContributionsService } from '../savings-contributions.service.js';
import {
  CUSTOMER_ID,
  FUNDING_ACCOUNT_ID,
  GOAL_ACCOUNT_ID,
  GOAL_ID,
  NOW,
  chainQuery,
  goalDoc,
} from './fixtures.js';

const SESSION = { name: 'unit-test-session' } as unknown as ClientSession;

function setup(goal: SavingsGoalDoc | null = goalDoc()) {
  const aggregateExec = vi.fn().mockResolvedValue([{ total: 70 }]);
  const contributions = {
    aggregate: vi.fn().mockReturnValue({ exec: aggregateExec }),
    create: vi.fn().mockResolvedValue([]),
  };
  const goals = {
    findOne: vi.fn().mockReturnValue(chainQuery(goal)),
    findById: vi.fn().mockReturnValue(chainQuery(goal)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const accounts = {
    loadSpendable: vi
      .fn()
      .mockResolvedValue({ _id: FUNDING_ACCOUNT_ID, currency: 'GBP', number: '100200' }),
    balancesFor: vi.fn().mockResolvedValue({ available: fromMinorUnits(10_000, 'GBP') }),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: ClientSession) => Promise<unknown>) => work(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new SavingsContributionsService(
    contributions as unknown as Model<SavingsContributionDoc>,
    goals as unknown as Model<SavingsGoalDoc>,
    accounts as unknown as AccountsService,
    ledger as unknown as LedgerService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, contributions, goals, accounts, ledger, transactionManager };
}

describe('SavingsContributionsService.applyRoundUp', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('sweeps the change from a purchase into the oldest round-up goal', async () => {
    const result = await deps.service.applyRoundUp(
      CUSTOMER_ID,
      fromMinorUnits(430, 'GBP'),
      FUNDING_ACCOUNT_ID,
    );

    expect(deps.goals.findOne).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      roundUpsEnabled: true,
      status: 'active',
      currency: 'GBP',
    });
    expect(deps.contributions.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          goalId: GOAL_ID,
          fromAccountId: FUNDING_ACCOUNT_ID,
          minorUnits: 70,
          kind: 'round_up',
          transactionId: 'txn-1',
        }),
      ],
      { session: SESSION, ordered: true },
    );
    expect(result?.saved.minorUnits).toBe(70);
  });

  it('does nothing when the customer has no eligible round-up goal', async () => {
    deps = setup(null);

    const result = await deps.service.applyRoundUp(
      CUSTOMER_ID,
      fromMinorUnits(430, 'GBP'),
      FUNDING_ACCOUNT_ID,
    );

    expect(result).toBeNull();
    expect(deps.accounts.balancesFor).not.toHaveBeenCalled();
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('sweeps nothing for a purchase that already lands on a whole unit', async () => {
    const result = await deps.service.applyRoundUp(
      CUSTOMER_ID,
      fromMinorUnits(500, 'GBP'),
      FUNDING_ACCOUNT_ID,
    );

    expect(result).toBeNull();
    expect(deps.accounts.balancesFor).not.toHaveBeenCalled();
  });

  it('never sweeps a purchase charged to the account that holds the goal', async () => {
    const result = await deps.service.applyRoundUp(
      CUSTOMER_ID,
      fromMinorUnits(430, 'GBP'),
      GOAL_ACCOUNT_ID,
    );

    expect(result).toBeNull();
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('skips the sweep rather than overdrawing the funding account', async () => {
    deps.accounts.balancesFor.mockResolvedValue({ available: fromMinorUnits(69, 'GBP') });

    const result = await deps.service.applyRoundUp(
      CUSTOMER_ID,
      fromMinorUnits(430, 'GBP'),
      FUNDING_ACCOUNT_ID,
    );

    expect(result).toBeNull();
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });
});
