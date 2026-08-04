import { vi } from 'vitest';

import type { SavingsGoalDoc } from '../infrastructure/savings-goal.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const TODAY = '2026-08-04';
export const CUSTOMER_ID = 'cust-1';
export const GOAL_ID = 'goal-1';
export const GOAL_ACCOUNT_ID = 'acct-goal';
export const FUNDING_ACCOUNT_ID = 'acct-funding';

/** An active goal with a target date one year out; tests override the fields they exercise. */
export function goalDoc(overrides: Partial<SavingsGoalDoc> = {}): SavingsGoalDoc {
  return {
    _id: GOAL_ID,
    customerId: CUSTOMER_ID,
    accountId: GOAL_ACCOUNT_ID,
    name: 'House deposit',
    icon: 'home',
    targetMinorUnits: 100_000,
    currency: 'GBP',
    targetDate: '2027-08-04',
    roundUpsEnabled: true,
    autoContribution: null,
    status: 'active',
    createdAt: NOW,
    achievedAt: null,
    ...overrides,
  };
}

type ChainMock = Record<string, ReturnType<typeof vi.fn>>;

/**
 * A Mongoose query stand-in: every chaining method returns the same object, `lean` resolves.
 * Models are mocked only here — the port boundary — never deeper into the module.
 */
export function chainQuery(result: unknown): ChainMock {
  const chain: ChainMock = {};
  for (const method of ['sort', 'select', 'limit', 'skip', 'session']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain['lean'] = vi.fn().mockResolvedValue(result);
  return chain;
}
