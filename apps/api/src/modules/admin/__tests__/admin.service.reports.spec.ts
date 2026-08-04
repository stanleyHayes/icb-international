import type { MonitorEntry } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { listGlAccounts } from '../../ledger/domain/chart-of-accounts.js';
import type {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../ledger/infrastructure/ledger.schemas.js';
import { AdminService } from '../admin.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const BOOKED = new Date('2026-08-04T09:30:00.000Z');

function makeHarness() {
  const customers = { countDocuments: vi.fn() };
  const accounts = { countDocuments: vi.fn() };
  const transactions = { estimatedDocumentCount: vi.fn(), find: vi.fn() };
  const entries = { aggregate: vi.fn().mockResolvedValue([]), find: vi.fn() };
  const balances = { find: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new AdminService(
    customers as unknown as Model<CustomerDoc>,
    accounts as unknown as Model<AccountDoc>,
    transactions as unknown as Model<LedgerTransactionDoc>,
    entries as unknown as Model<LedgerEntryDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    clock,
  );
  return { service, transactions, entries };
}

function transactionRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'txn-1',
    reference: 'REF-001',
    type: 'transfer',
    status: 'posted',
    actor: { kind: 'customer', id: 'cust-1', label: 'Ada Lovelace' },
    bookedAt: BOOKED,
    sourceType: 'internal',
    ...overrides,
  };
}

function monitorQuery(rows: unknown[]) {
  const lean = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ lean });
  const sort = vi.fn().mockReturnValue({ limit });
  return { sort, limit, lean };
}

describe('AdminService.trialBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps every GL account, taking each balance in its natural direction', async () => {
    const { service, entries } = makeHarness();
    entries.aggregate.mockResolvedValue([
      { _id: 'gl:1000', debit: 500, credit: 200 },
      { _id: 'gl:4000', debit: 200, credit: 500 },
    ]);

    const report = await service.trialBalance();

    expect(report.asOf).toBe(NOW.toISOString());
    expect(report.currency).toBe('USD');
    expect(report.lines).toHaveLength(listGlAccounts().length);
    const byCode = new Map(report.lines.map((line) => [line.accountCode, line]));
    // Cash is debit-normal: 500 - 200.
    expect(byCode.get('1000')).toMatchObject({
      accountName: 'Cash and central bank',
      type: 'asset',
      debit: { minorUnits: 500 },
      credit: { minorUnits: 200 },
      balance: { minorUnits: 300 },
    });
    // Fee income is credit-normal: 500 - 200.
    expect(byCode.get('4000')?.balance).toEqual({ minorUnits: 300, currency: 'USD', scale: 2 });
    // An account with no entries shows zeroes rather than disappearing.
    expect(byCode.get('9900')).toMatchObject({
      debit: { minorUnits: 0 },
      credit: { minorUnits: 0 },
      balance: { minorUnits: 0 },
    });
    expect(report.totalDebits).toEqual({ minorUnits: 700, currency: 'USD', scale: 2 });
    expect(report.totalCredits).toEqual({ minorUnits: 700, currency: 'USD', scale: 2 });
    expect(report.balanced).toBe(true);
  });

  it('flags the books as unbalanced when debits and credits disagree', async () => {
    const { service, entries } = makeHarness();
    entries.aggregate.mockResolvedValue([{ _id: 'gl:1000', debit: 100, credit: 0 }]);

    const report = await service.trialBalance();

    expect(report.balanced).toBe(false);
    expect(report.totalDebits).toEqual({ minorUnits: 100, currency: 'USD', scale: 2 });
    expect(report.totalCredits).toEqual({ minorUnits: 0, currency: 'USD', scale: 2 });
  });

  it('aggregates only base-currency GL entries', async () => {
    const { service, entries } = makeHarness();

    await service.trialBalance();

    const pipeline = entries.aggregate.mock.calls[0]?.[0] as unknown[];
    expect(pipeline[0]).toEqual({ $match: { accountRef: { $regex: '^gl:' }, currency: 'USD' } });
  });
});

describe('AdminService.monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('joins each transaction to its first entry, newest first, honouring the limit', async () => {
    const { service, transactions, entries } = makeHarness();
    const query = monitorQuery([transactionRow()]);
    transactions.find.mockReturnValue({ sort: query.sort });
    entries.find.mockReturnValue({
      lean: () =>
        Promise.resolve([
          {
            transactionId: 'txn-1',
            accountRef: 'acct:acct-1',
            direction: 'credit',
            minorUnits: 12_345,
            currency: 'USD',
          },
          {
            transactionId: 'txn-1',
            accountRef: 'gl:1000',
            direction: 'debit',
            minorUnits: 12_345,
            currency: 'USD',
          },
        ]),
    });

    const rows = await service.monitor(5);

    expect(query.sort).toHaveBeenCalledWith({ bookedAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(entries.find).toHaveBeenCalledWith({ transactionId: { $in: ['txn-1'] } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      transactionId: 'txn-1',
      reference: 'REF-001',
      at: BOOKED.toISOString(),
      customerId: null,
      customerName: 'Ada Lovelace',
      accountLabel: 'acct:acct-1',
      type: 'transfer',
      status: 'posted',
      direction: 'credit',
      amount: { minorUnits: 12_345, currency: 'USD', scale: 2 },
      rail: 'internal',
      riskScore: null,
      flagged: false,
    } satisfies MonitorEntry);
  });

  it('falls back to placeholder values when a transaction has no entries', async () => {
    const { service, transactions, entries } = makeHarness();
    const query = monitorQuery([transactionRow({ sourceType: null })]);
    transactions.find.mockReturnValue({ sort: query.sort });
    entries.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    const rows = await service.monitor();

    expect(rows[0]).toMatchObject({
      accountLabel: '—',
      direction: 'debit',
      amount: { minorUnits: 0, currency: 'USD', scale: 2 },
      rail: null,
    });
  });

  it('defaults the limit to 40', async () => {
    const { service, transactions, entries } = makeHarness();
    const query = monitorQuery([]);
    transactions.find.mockReturnValue({ sort: query.sort });
    entries.find.mockReturnValue({ lean: () => Promise.resolve([]) });

    await service.monitor();

    expect(query.limit).toHaveBeenCalledWith(40);
  });
});

describe('AdminService.describeGlAccount', () => {
  it('names a known GL code and throws for an unknown one', () => {
    const { service } = makeHarness();

    expect(service.describeGlAccount('1000')).toBe('Cash and central bank');
    expect(() => service.describeGlAccount('0000')).toThrow('Unknown general-ledger account code');
  });
});
