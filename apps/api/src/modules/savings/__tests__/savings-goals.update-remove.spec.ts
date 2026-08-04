import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type AccountsService } from '../../accounts/accounts.service.js';
import type { SavingsGoalDoc } from '../infrastructure/savings-goal.schemas.js';
import { type SavingsContributionsService } from '../savings-contributions.service.js';
import { SavingsGoalsService, type UpdateSavingsGoalRequest } from '../savings-goals.service.js';
import { CUSTOMER_ID, FUNDING_ACCOUNT_ID, GOAL_ID, NOW, chainQuery, goalDoc } from './fixtures.js';

function setup(goal: SavingsGoalDoc | null = goalDoc()) {
  const goals = {
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    find: vi.fn(),
    findOne: vi.fn().mockReturnValue(chainQuery(goal)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const contributions = {
    savedFor: vi.fn().mockResolvedValue(new Map<string, number>()),
    savedForOne: vi.fn().mockResolvedValue(0),
    countFor: vi.fn().mockResolvedValue(0),
    contribute: vi.fn(),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ _id: FUNDING_ACCOUNT_ID, currency: 'GBP' }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new SavingsGoalsService(
    goals as unknown as Model<SavingsGoalDoc>,
    contributions as unknown as SavingsContributionsService,
    accounts as unknown as AccountsService,
    clock,
  );
  return { service, goals, contributions, accounts };
}

describe('SavingsGoalsService.update', () => {
  it('patches only the fields that were sent, then re-reads the goal', async () => {
    const deps = setup();
    const patch: UpdateSavingsGoalRequest = { name: 'New name', roundUpsEnabled: false };

    const result = await deps.service.update(CUSTOMER_ID, GOAL_ID, patch);

    expect(deps.goals.updateOne).toHaveBeenCalledWith(
      { _id: GOAL_ID, customerId: CUSTOMER_ID },
      { $set: { name: 'New name', roundUpsEnabled: false } },
    );
    expect(result.id).toBe(GOAL_ID);
  });

  it('writes nothing for an empty patch but still returns the goal', async () => {
    const deps = setup();

    const result = await deps.service.update(CUSTOMER_ID, GOAL_ID, {});

    expect(deps.goals.updateOne).not.toHaveBeenCalled();
    expect(result.id).toBe(GOAL_ID);
  });

  it('rejects a target in a different currency than the goal', async () => {
    const deps = setup();

    await expect(
      deps.service.update(CUSTOMER_ID, GOAL_ID, {
        target: { minorUnits: 50_000, currency: 'USD', scale: 2 },
      }),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error);
    expect(deps.goals.updateOne).not.toHaveBeenCalled();
  });

  it('accepts a status change and a new target in the goal currency', async () => {
    const deps = setup();

    await deps.service.update(CUSTOMER_ID, GOAL_ID, {
      status: 'paused',
      target: { minorUnits: 50_000, currency: 'GBP', scale: 2 },
    });

    expect(deps.goals.updateOne).toHaveBeenCalledWith(
      { _id: GOAL_ID, customerId: CUSTOMER_ID },
      { $set: { status: 'paused', targetMinorUnits: 50_000 } },
    );
  });

  it('rebuilds the standing instruction when the auto contribution is patched', async () => {
    const deps = setup();

    await deps.service.update(CUSTOMER_ID, GOAL_ID, {
      autoContribution: {
        amount: { minorUnits: 2_500, currency: 'GBP', scale: 2 },
        frequency: 'weekly',
        fromAccountId: FUNDING_ACCOUNT_ID,
      },
    });

    expect(deps.goals.updateOne).toHaveBeenCalledWith(
      { _id: GOAL_ID, customerId: CUSTOMER_ID },
      {
        $set: {
          autoContribution: {
            amountMinorUnits: 2_500,
            frequency: 'weekly',
            nextRunOn: '2026-08-11',
            fromAccountId: FUNDING_ACCOUNT_ID,
          },
        },
      },
    );
  });

  it('rejects an auto contribution funded from an account in another currency', async () => {
    const deps = setup();
    deps.accounts.loadSpendable.mockResolvedValue({ _id: FUNDING_ACCOUNT_ID, currency: 'USD' });

    await expect(
      deps.service.update(CUSTOMER_ID, GOAL_ID, {
        autoContribution: {
          amount: { minorUnits: 2_500, currency: 'GBP', scale: 2 },
          frequency: 'weekly',
          fromAccountId: FUNDING_ACCOUNT_ID,
        },
      }),
    ).rejects.toThrow(DomainError);
    expect(deps.goals.updateOne).not.toHaveBeenCalled();
  });

  it('throws NotFound for a goal the customer does not own', async () => {
    const deps = setup(null);

    await expect(deps.service.update(CUSTOMER_ID, GOAL_ID, { name: 'New name' })).rejects.toThrow(
      NotFoundError,
    );
    expect(deps.goals.updateOne).not.toHaveBeenCalled();
  });
});

describe('SavingsGoalsService.remove', () => {
  it('deletes a goal that never took a contribution', async () => {
    const deps = setup();

    await deps.service.remove(CUSTOMER_ID, GOAL_ID);

    expect(deps.goals.deleteOne).toHaveBeenCalledWith({ _id: GOAL_ID, customerId: CUSTOMER_ID });
    expect(deps.goals.updateOne).not.toHaveBeenCalled();
  });

  it('cancels rather than deletes a goal whose contributions must keep explaining the money', async () => {
    const deps = setup();
    deps.contributions.countFor.mockResolvedValue(3);

    await deps.service.remove(CUSTOMER_ID, GOAL_ID);

    expect(deps.goals.updateOne).toHaveBeenCalledWith(
      { _id: GOAL_ID, customerId: CUSTOMER_ID },
      { $set: { status: 'cancelled' } },
    );
    expect(deps.goals.deleteOne).not.toHaveBeenCalled();
  });

  it('throws NotFound for a goal the customer does not own', async () => {
    const deps = setup(null);

    await expect(deps.service.remove(CUSTOMER_ID, GOAL_ID)).rejects.toThrow(NotFoundError);
    expect(deps.goals.deleteOne).not.toHaveBeenCalled();
    expect(deps.goals.updateOne).not.toHaveBeenCalled();
  });
});
