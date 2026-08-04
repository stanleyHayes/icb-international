import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ConflictError,
  InsufficientFundsError,
  NotFoundError,
} from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type AccountsService } from '../../accounts/accounts.service.js';
import { type LedgerService } from '../../ledger/ledger.service.js';
import type {
  SavingsContributionDoc,
  SavingsGoalDoc,
} from '../infrastructure/savings-goal.schemas.js';
import { SavingsContributionsService } from '../savings-contributions.service.js';
import { CUSTOMER_ID, FUNDING_ACCOUNT_ID, GOAL_ACCOUNT_ID, GOAL_ID, NOW, goalDoc } from './fixtures.js';

const SESSION = { name: 'unit-test-session' } as unknown as ClientSession;

function setup(goal: SavingsGoalDoc | null = goalDoc()) {
  const aggregateExec = vi.fn().mockResolvedValue([{ total: 5_000 }]);
  const contributions = {
    aggregate: vi.fn().mockReturnValue({ exec: aggregateExec }),
    countDocuments: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue([]),
  };
  const goals = {
    findOne: vi.fn(),
    findById: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(goal) }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const accounts = {
    loadSpendable: vi
      .fn()
      .mockResolvedValue({ _id: FUNDING_ACCOUNT_ID, currency: 'GBP', number: '100200' }),
    balancesFor: vi.fn().mockResolvedValue({
      ledger: fromMinorUnits(10_000, 'GBP'),
      holds: fromMinorUnits(0, 'GBP'),
      available: fromMinorUnits(10_000, 'GBP'),
    }),
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
  return { service, contributions, goals, accounts, ledger, transactionManager, aggregateExec };
}

describe('SavingsContributionsService saved totals', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('savedFor returns an empty map without querying when there are no goals', async () => {
    const result = await deps.service.savedFor([]);

    expect(result.size).toBe(0);
    expect(deps.contributions.aggregate).not.toHaveBeenCalled();
  });

  it('savedFor groups contribution sums per goal in one pipeline', async () => {
    deps.aggregateExec.mockResolvedValue([
      { _id: 'goal-1', total: 25_000 },
      { _id: 'goal-2', total: 4_000 },
    ]);

    const result = await deps.service.savedFor(['goal-1', 'goal-2']);

    expect(deps.contributions.aggregate).toHaveBeenCalledWith([
      { $match: { goalId: { $in: ['goal-1', 'goal-2'] } } },
      { $group: { _id: '$goalId', total: { $sum: '$minorUnits' } } },
    ]);
    expect(result.get('goal-1')).toBe(25_000);
    expect(result.get('goal-2')).toBe(4_000);
  });

  it('savedForOne returns the goal total, or zero when nothing is saved', async () => {
    await expect(deps.service.savedForOne(GOAL_ID)).resolves.toBe(5_000);

    deps.aggregateExec.mockResolvedValue([]);
    await expect(deps.service.savedForOne(GOAL_ID)).resolves.toBe(0);
  });

  it('savedForOne reads inside the posting session when one is supplied', async () => {
    await deps.service.savedForOne(GOAL_ID, SESSION);

    expect(deps.contributions.aggregate).toHaveBeenCalledWith(expect.any(Array), {
      session: SESSION,
    });
  });

  it('countFor counts the goal contribution records', async () => {
    deps.contributions.countDocuments.mockResolvedValue(3);

    await expect(deps.service.countFor(GOAL_ID)).resolves.toBe(3);
    expect(deps.contributions.countDocuments).toHaveBeenCalledWith({ goalId: GOAL_ID });
  });
});

describe('SavingsContributionsService.contribute', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('posts a balanced transfer and records the contribution in one transaction', async () => {
    const result = await deps.service.contribute(
      CUSTOMER_ID,
      goalDoc(),
      FUNDING_ACCOUNT_ID,
      fromMinorUnits(5_000, 'GBP'),
    );

    expect(deps.ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transfer_out',
        sourceType: 'savings_goal',
        sourceId: GOAL_ID,
        metadata: { goalId: GOAL_ID, contributionKind: 'manual' },
        lines: [
          expect.objectContaining({ direction: 'debit', amount: { minorUnits: 5_000, currency: 'GBP' } }),
          expect.objectContaining({ direction: 'credit', amount: { minorUnits: 5_000, currency: 'GBP' } }),
        ],
      }),
      SESSION,
    );
    expect(deps.contributions.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          goalId: GOAL_ID,
          customerId: CUSTOMER_ID,
          fromAccountId: FUNDING_ACCOUNT_ID,
          minorUnits: 5_000,
          currency: 'GBP',
          kind: 'manual',
          transactionId: 'txn-1',
          createdAt: NOW,
        }),
      ],
      { session: SESSION, ordered: true },
    );
    expect(result.saved.minorUnits).toBe(5_000);
  });

  it('marks the goal achieved the moment the saved total reaches the target', async () => {
    deps.aggregateExec.mockResolvedValue([{ total: 100_000 }]);

    await deps.service.contribute(
      CUSTOMER_ID,
      goalDoc(),
      FUNDING_ACCOUNT_ID,
      fromMinorUnits(5_000, 'GBP'),
    );

    expect(deps.goals.updateOne).toHaveBeenCalledWith(
      { _id: GOAL_ID },
      { $set: { status: 'achieved', achievedAt: NOW } },
      { session: SESSION },
    );
  });

  it('does not re-mark a goal that is already achieved', async () => {
    deps.aggregateExec.mockResolvedValue([{ total: 150_000 }]);

    await deps.service.contribute(
      CUSTOMER_ID,
      goalDoc({ status: 'achieved', achievedAt: NOW }),
      FUNDING_ACCOUNT_ID,
      fromMinorUnits(5_000, 'GBP'),
    );

    expect(deps.goals.updateOne).not.toHaveBeenCalled();
  });

  it('refuses a contribution to a goal that is not active or achieved', async () => {
    await expect(
      deps.service.contribute(
        CUSTOMER_ID,
        goalDoc({ status: 'paused' }),
        FUNDING_ACCOUNT_ID,
        fromMinorUnits(5_000, 'GBP'),
      ),
    ).rejects.toThrow(ConflictError);
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
  });

  it('refuses to fund a goal from the account that holds it', async () => {
    await expect(
      deps.service.contribute(
        CUSTOMER_ID,
        goalDoc(),
        GOAL_ACCOUNT_ID,
        fromMinorUnits(5_000, 'GBP'),
      ),
    ).rejects.toThrow(ConflictError);
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
  });

  it('rejects a contribution when the funding account is in another currency', async () => {
    deps.accounts.loadSpendable.mockResolvedValue({
      _id: FUNDING_ACCOUNT_ID,
      currency: 'USD',
      number: '100200',
    });

    await expect(
      deps.service.contribute(
        CUSTOMER_ID,
        goalDoc(),
        FUNDING_ACCOUNT_ID,
        fromMinorUnits(5_000, 'GBP'),
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error);
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('rejects a contribution the available balance cannot cover', async () => {
    deps.accounts.balancesFor.mockResolvedValue({
      ledger: fromMinorUnits(4_000, 'GBP'),
      holds: fromMinorUnits(0, 'GBP'),
      available: fromMinorUnits(4_000, 'GBP'),
    });

    await expect(
      deps.service.contribute(
        CUSTOMER_ID,
        goalDoc(),
        FUNDING_ACCOUNT_ID,
        fromMinorUnits(5_000, 'GBP'),
      ),
    ).rejects.toThrow(InsufficientFundsError);
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('throws NotFound when the goal vanishes between posting and reload', async () => {
    deps.goals.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(
      deps.service.contribute(
        CUSTOMER_ID,
        goalDoc(),
        FUNDING_ACCOUNT_ID,
        fromMinorUnits(5_000, 'GBP'),
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
