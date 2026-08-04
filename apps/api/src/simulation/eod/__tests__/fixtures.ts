import type { ClientSession } from 'mongoose';
import { vi } from 'vitest';

import type { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import type { EodContext } from '../eod.context.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const BUSINESS_DATE = '2026-08-04';
export const CONTEXT: EodContext = { businessDate: BUSINESS_DATE, asOf: NOW };
export const SESSION = {} as ClientSession;

export function accountDoc(overrides: Partial<AccountDoc> = {}): AccountDoc {
  return {
    _id: 'acct-1',
    customerId: 'cust-1',
    kind: 'savings',
    currency: 'USD',
    status: 'active',
    statementDay: 4,
    interestRate: null,
    monthlyFeeMinorUnits: 500,
    ...overrides,
  } as AccountDoc;
}

/** Mongoose query chain terminal: `.lean()` resolving to `result`. */
export function leanQuery<T>(result: T): { lean: ReturnType<typeof vi.fn> } {
  return { lean: vi.fn().mockResolvedValue(result) };
}

/** A `find()` chain ending in `.sort().lean()`. */
export function sortedLeanQuery<T>(result: T): { sort: ReturnType<typeof vi.fn> } {
  return { sort: vi.fn().mockReturnValue(leanQuery(result)) };
}

/** A TransactionManager stand-in that runs the work inline with a fake session. */
export function inlineTransactions(): { withTransaction: ReturnType<typeof vi.fn> } {
  return {
    withTransaction: vi.fn(<T>(work: (session: ClientSession) => Promise<T>): Promise<T> =>
      work(SESSION),
    ),
  };
}

/** What Mongo throws when the idempotency index rejects a second claim. */
export function duplicateKeyError(): Error {
  return Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
}
