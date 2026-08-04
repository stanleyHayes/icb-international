import type { TransactionSummary } from '@icb/contracts';

const BASE: TransactionSummary = {
  id: '01J9ZQZ3X00000000000000001',
  accountId: '01J9ZQZ3X00000000000000002',
  reference: 'TXN-2026-0001',
  type: 'card_purchase',
  status: 'posted',
  direction: 'debit',
  amount: { minorUnits: 4599, currency: 'USD', scale: 2 },
  runningBalance: { minorUnits: 1205401, currency: 'USD', scale: 2 },
  description: 'Weekly groceries',
  category: 'groceries',
  merchant: {
    name: 'Corner Market',
    category: 'groceries',
    mcc: '5411',
    city: 'Accra',
    country: 'GH',
    logoUrl: null,
  },
  counterparty: null,
  bookedAt: '2026-01-15T14:32:00Z',
  valueDate: '2026-01-15',
  pending: false,
};

/** A valid TransactionSummary with per-test overrides. */
export function makeTransaction(overrides: Partial<TransactionSummary> = {}): TransactionSummary {
  return { ...BASE, ...overrides };
}
