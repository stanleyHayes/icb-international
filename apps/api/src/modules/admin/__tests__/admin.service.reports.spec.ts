import type { MonitorEntry } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../ledger/infrastructure/ledger.schemas.js';
import { TrialBalanceService } from '../../ledger/trial-balance.service.js';
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
  const trialBalanceService = {
    generate: vi.fn().mockResolvedValue({
      asOf: NOW.toISOString(),
      currency: 'USD',
      lines: [],
      totalDebits: { minorUnits: 0, currency: 'USD', scale: 2 },
      totalCredits: { minorUnits: 0, currency: 'USD', scale: 2 },
      balanced: true,
    }),
  };
  const service = new AdminService(
    customers as unknown as Model<CustomerDoc>,
    accounts as unknown as Model<AccountDoc>,
    transactions as unknown as Model<LedgerTransactionDoc>,
    entries as unknown as Model<LedgerEntryDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    trialBalanceService as unknown as TrialBalanceService,
    clock,
  );
  return { service, transactions, entries, trialBalanceService };
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

  it('delegates to the ledger module, so staff see the one definition of balanced', async () => {
    // The report itself is covered in ledger/__tests__/trial-balance.service.spec.ts.
    const { service, trialBalanceService } = makeHarness();

    const report = await service.trialBalance();

    expect(trialBalanceService.generate).toHaveBeenCalledWith('USD');
    expect(report.currency).toBe('USD');
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
