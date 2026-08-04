import { vi } from 'vitest';

import type {
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../ledger/infrastructure/ledger.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const CUSTOMER_ID = 'cust-1';
export const ACCOUNT_ID = 'acct-1';
export const ACCOUNT_REF = `acct:${ACCOUNT_ID}`;

/** A settled debit entry; override per test. */
export function ledgerEntry(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: '01JENTRY000000000000001',
    transactionId: 'txn-1',
    accountRef: ACCOUNT_REF,
    direction: 'debit',
    minorUnits: 1_299,
    currency: 'USD',
    signedMinorUnits: -1_299,
    valueDate: '2026-07-01',
    bookedAt: new Date('2026-07-01T08:00:00.000Z'),
    sequence: 1,
    narrative: 'Netflix',
    transactionType: 'card_purchase',
    transactionStatus: 'settled',
    ...overrides,
  };
}

/** The ledger-transaction header behind the entry. */
export function ledgerHeader(overrides: Partial<LedgerTransactionDoc> = {}): LedgerTransactionDoc {
  return {
    _id: 'txn-1',
    reference: 'TRF-2026-0001',
    type: 'card_purchase',
    status: 'settled',
    description: 'Netflix subscription',
    actor: { kind: 'customer', id: CUSTOMER_ID, label: 'Customer' },
    valueDate: '2026-07-01',
    bookedAt: new Date('2026-07-01T08:00:00.000Z'),
    settledAt: new Date('2026-07-01T09:00:00.000Z'),
    reversesTransactionId: null,
    reversedByTransactionId: null,
    sourceType: null,
    sourceId: null,
    correlationId: null,
    metadata: {},
    ...overrides,
  };
}

/** A mongoose-style chainable query double resolving to `result` at `.lean()`. */
export function leanQuery<T>(result: T): {
  sort: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  lean: ReturnType<typeof vi.fn>;
} {
  const chain = {
    sort: vi.fn(),
    limit: vi.fn(),
    select: vi.fn(),
    lean: vi.fn().mockResolvedValue(result),
  };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}
