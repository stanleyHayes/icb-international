import type { CreateSavingsGoalRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { SavingsGoalDoc } from '../infrastructure/savings-goal.schemas.js';
import type { SavingsContributionsService } from '../savings-contributions.service.js';
import { SavingsGoalsService } from '../savings-goals.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

function queryChain<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function goalDoc(overrides: Partial<SavingsGoalDoc> = {}): SavingsGoalDoc {
  return {
    _id: 'goal-1',
    customerId: 'cust-1',
    accountId: 'acct-1',
    name: 'Holiday',
    icon: 'plane',
    targetMinorUnits: 120_000,
    currency: 'GHS',
    targetDate: '2027-01-01',
    roundUpsEnabled: false,
    autoContribution: null,
    status: 'active',
    createdAt: NOW,
    achievedAt: null,
    ...overrides,
  };
}

function createRequest(overrides: Partial<CreateSavingsGoalRequest> = {}): CreateSavingsGoalRequest {
  return {
    accountId: 'acct-1',
    name: 'Holiday',
    icon: 'plane',
    target: { minorUnits: 120_000, currency: 'GHS', scale: 2 },
    roundUpsEnabled: false,
    ...overrides,
  };
}

function setup({ goal = null as SavingsGoalDoc | null, goals = [] as SavingsGoalDoc[] } = {}) {
  const goalsModel = {
    create: vi.fn().mockImplementation((docs: unknown[]) => Promise.resolve(docs)),
    find: vi.fn().mockReturnValue(queryChain(goals)),
    findOne: vi.fn().mockReturnValue(queryChain(goal)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const contributions = {
    savedFor: vi.fn().mockResolvedValue(new Map([['goal-1', 30_000]])),
    savedForOne: vi.fn().mockResolvedValue(30_000),
    countFor: vi.fn().mockResolvedValue(0),
    contribute: vi.fn().mockResolvedValue({ id: 'goal-1' }),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-1', currency: 'GHS' }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new SavingsGoalsService(
    goalsModel as unknown as Model<SavingsGoalDoc>,
    contributions as unknown as SavingsContributionsService,
    accounts as unknown as AccountsService,
    clock,
  );
  return { service, goalsModel, contributions, accounts };
}

describe('SavingsGoalsService.create', () => {
  it('rejects a target in a different currency than the account', async () => {
    const { service, goalsModel } = setup();

    await expect(
      service.create(
        'cust-1',
        createRequest({ target: { minorUnits: 120_000, currency: 'USD', scale: 2 } }),
      ),
    ).rejects.toBeInstanceOf(DomainError);
    expect(goalsModel.create).not.toHaveBeenCalled();
  });

  it('creates an active goal against the spendable account', async () => {
    const { service, goalsModel } = setup();

    const goal = await service.create('cust-1', createRequest());

    const [docs] = goalsModel.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(docs[0]).toMatchObject({
      customerId: 'cust-1',
      accountId: 'acct-1',
      targetMinorUnits: 120_000,
      currency: 'GHS',
      status: 'active',
      createdAt: NOW,
      autoContribution: null,
    });
    expect(goal.saved.minorUnits).toBe(0);
    expect(goal.progress).toBe(0);
  });

  it('validates and schedules an auto-contribution from a same-currency source', async () => {
    const { service, goalsModel } = setup();

    await service.create(
      'cust-1',
      createRequest({
        autoContribution: {
          amount: { minorUnits: 10_000, currency: 'GHS', scale: 2 },
          frequency: 'monthly',
          fromAccountId: 'acct-1',
        },
      }),
    );

    const [docs] = goalsModel.create.mock.calls[0] as [
      { autoContribution: Record<string, unknown> }[],
    ];
    expect(docs[0]?.autoContribution).toMatchObject({
      amountMinorUnits: 10_000,
      frequency: 'monthly',
      nextRunOn: '2026-09-04',
      fromAccountId: 'acct-1',
    });
  });

  it('rejects an auto-contribution source in another currency', async () => {
    const { service, accounts } = setup();
    accounts.loadSpendable
      .mockResolvedValueOnce({ _id: 'acct-1', currency: 'GHS' })
      .mockResolvedValueOnce({ _id: 'acct-2', currency: 'USD' });

    await expect(
      service.create(
        'cust-1',
        createRequest({
          autoContribution: {
            amount: { minorUnits: 10_000, currency: 'GHS', scale: 2 },
            frequency: 'weekly',
            fromAccountId: 'acct-2',
          },
        }),
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('fails when persistence returns nothing', async () => {
    const { service, goalsModel } = setup();
    goalsModel.create.mockResolvedValue([undefined]);

    await expect(service.create('cust-1', createRequest())).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('SavingsGoalsService.list', () => {
  it('joins each goal with its saved total', async () => {
    const { service } = setup({ goals: [goalDoc()] });

    const [goal] = await service.list('cust-1');

    expect(goal?.saved.minorUnits).toBe(30_000);
    expect(goal?.progress).toBe(0.25);
  });
});

describe('SavingsGoalsService.get', () => {
  it('throws NotFoundError for a foreign or missing goal', async () => {
    const { service } = setup({ goal: null });

    await expect(service.get('cust-1', 'goal-9')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the owned goal with its saved total', async () => {
    const { service } = setup({ goal: goalDoc() });

    const goal = await service.get('cust-1', 'goal-1');

    expect(goal.saved.minorUnits).toBe(30_000);
  });
});

describe('SavingsGoalsService.update', () => {
  it('applies only the patched fields', async () => {
    const { service, goalsModel } = setup({ goal: goalDoc() });

    await service.update('cust-1', 'goal-1', { name: 'Honeymoon' });

    expect(goalsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'goal-1', customerId: 'cust-1' },
      { $set: { name: 'Honeymoon' } },
    );
  });

  it('skips the write when the patch is empty', async () => {
    const { service, goalsModel } = setup({ goal: goalDoc() });

    await service.update('cust-1', 'goal-1', {});

    expect(goalsModel.updateOne).not.toHaveBeenCalled();
  });

  it('rejects a target currency change away from the goal currency', async () => {
    const { service } = setup({ goal: goalDoc() });

    await expect(
      service.update('cust-1', 'goal-1', {
        target: { minorUnits: 50_000, currency: 'USD', scale: 2 },
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe('SavingsGoalsService.remove', () => {
  it('deletes a goal that never took a contribution', async () => {
    const { service, goalsModel } = setup({ goal: goalDoc() });

    await service.remove('cust-1', 'goal-1');

    expect(goalsModel.deleteOne).toHaveBeenCalledWith({ _id: 'goal-1', customerId: 'cust-1' });
    expect(goalsModel.updateOne).not.toHaveBeenCalled();
  });

  it('cancels rather than deletes once money has moved', async () => {
    const { service, goalsModel, contributions } = setup({ goal: goalDoc() });
    contributions.countFor.mockResolvedValue(3);

    await service.remove('cust-1', 'goal-1');

    expect(goalsModel.deleteOne).not.toHaveBeenCalled();
    expect(goalsModel.updateOne).toHaveBeenCalledWith(
      { _id: 'goal-1', customerId: 'cust-1' },
      { $set: { status: 'cancelled' } },
    );
  });
});

describe('SavingsGoalsService.contribute', () => {
  it('delegates to the contributions service with the owned goal', async () => {
    const goal = goalDoc();
    const { service, contributions } = setup({ goal });

    await service.contribute('cust-1', 'goal-1', {
      fromAccountId: 'acct-1',
      amount: { minorUnits: 10_000, currency: 'GHS', scale: 2 },
    });

    expect(contributions.contribute).toHaveBeenCalledWith(
      'cust-1',
      goal,
      'acct-1',
      expect.objectContaining({ minorUnits: 10_000, currency: 'GHS' }),
    );
  });
});
