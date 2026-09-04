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
const START_OF_DAY = new Date('2026-08-04T00:00:00.000Z');

function makeHarness() {
  const customers = { countDocuments: vi.fn().mockResolvedValue(5) };
  const accounts = { countDocuments: vi.fn().mockResolvedValue(7) };
  const transactions = { estimatedDocumentCount: vi.fn().mockResolvedValue(42), find: vi.fn() };
  const entries = { aggregate: vi.fn().mockResolvedValue([]), find: vi.fn() };
  const balances = { find: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);
  const trialBalanceService = { generate: vi.fn() };
  const service = new AdminService(
    customers as unknown as Model<CustomerDoc>,
    accounts as unknown as Model<AccountDoc>,
    transactions as unknown as Model<LedgerTransactionDoc>,
    entries as unknown as Model<LedgerEntryDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    trialBalanceService as unknown as TrialBalanceService,
    clock,
  );
  return { service, customers, accounts, transactions, entries, balances };
}

function leanRows(rows: unknown[]) {
  return { lean: () => Promise.resolve(rows) };
}

describe('AdminService.kpis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('composes the five headline figures from counts, balances and today’s entries', async () => {
    const { service, balances, entries } = makeHarness();
    balances.find.mockReturnValue(
      leanRows([{ ledgerMinorUnits: 100 }, { ledgerMinorUnits: 250 }]),
    );
    entries.aggregate.mockResolvedValue([{ total: 999 }]);

    const kpis = await service.kpis();

    expect(kpis).toHaveLength(5);
    const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi]));
    expect(byKey.get('deposits')).toMatchObject({
      label: 'Deposits under management',
      value: { minorUnits: 350, currency: 'USD', scale: 2 },
      format: 'money',
      positiveDirection: 'up',
    });
    expect(byKey.get('customers')).toMatchObject({ value: 5, format: 'count' });
    expect(byKey.get('accounts')).toMatchObject({ value: 7, format: 'count' });
    expect(byKey.get('postings')).toMatchObject({
      value: 42,
      format: 'count',
      positiveDirection: 'neutral',
    });
    expect(byKey.get('volume_today')).toMatchObject({
      value: { minorUnits: 999, currency: 'USD', scale: 2 },
      format: 'money',
    });
  });

  it('counts only non-closed customers and accounts', async () => {
    const { service, customers, accounts, balances } = makeHarness();
    balances.find.mockReturnValue(leanRows([]));

    await service.kpis();

    expect(customers.countDocuments).toHaveBeenCalledWith({ status: { $ne: 'closed' } });
    expect(accounts.countDocuments).toHaveBeenCalledWith({ status: { $ne: 'closed' } });
  });

  it('scopes today’s volume to debits booked since the frozen start of day', async () => {
    const { service, balances, entries } = makeHarness();
    balances.find.mockReturnValue(leanRows([]));
    entries.aggregate.mockResolvedValue([{ total: 10 }]);

    await service.kpis();

    expect(entries.aggregate).toHaveBeenCalledWith([
      { $match: { bookedAt: { $gte: START_OF_DAY }, direction: 'debit', currency: 'USD' } },
      { $group: { _id: null, total: { $sum: '$minorUnits' } } },
    ]);
  });

  it('reports zero deposits and zero volume when the ledger is empty', async () => {
    const { service, balances, entries } = makeHarness();
    balances.find.mockReturnValue(leanRows([]));
    entries.aggregate.mockResolvedValue([]);

    const kpis = await service.kpis();
    const byKey = new Map(kpis.map((kpi) => [kpi.key, kpi]));

    expect(byKey.get('deposits')?.value).toEqual({ minorUnits: 0, currency: 'USD', scale: 2 });
    expect(byKey.get('volume_today')?.value).toEqual({ minorUnits: 0, currency: 'USD', scale: 2 });
  });

  it('queries only customer-account USD balances for deposits under management', async () => {
    const { service, balances } = makeHarness();
    balances.find.mockReturnValue(leanRows([]));

    await service.kpis();

    expect(balances.find).toHaveBeenCalledWith({
      accountRef: { $regex: '^acct:' },
      currency: 'USD',
    });
  });
});
