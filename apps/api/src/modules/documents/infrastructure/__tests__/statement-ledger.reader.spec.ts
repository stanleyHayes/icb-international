import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../../ledger/infrastructure/ledger.schemas.js';
import { EMPTY_TOTALS } from '../../domain/statement-figures.js';
import { StatementLedgerReader } from '../statement-ledger.reader.js';

const ACCOUNT_REF = 'acct:acct-1';
const CURRENCY = 'GBP';

function leanQuery(result: unknown) {
  const chain = {
    sort: vi.fn(() => chain),
    select: vi.fn(() => chain),
    lean: () => Promise.resolve(result),
  };
  return chain;
}

function setup() {
  const entries = { find: vi.fn(), aggregate: vi.fn() };
  const transactions = { find: vi.fn() };
  const balances = { findOne: vi.fn() };
  const reader = new StatementLedgerReader(
    entries as unknown as Model<LedgerEntryDoc>,
    transactions as unknown as Model<LedgerTransactionDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
  );
  return { reader, entries, transactions, balances };
}

function entryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'entry-1',
    transactionId: 'txn-1',
    accountRef: ACCOUNT_REF,
    currency: CURRENCY,
    direction: 'credit',
    minorUnits: 20_000,
    signedMinorUnits: 20_000,
    valueDate: '2026-07-03',
    bookedAt: new Date('2026-07-03T09:00:00.000Z'),
    narrative: null,
    ...overrides,
  };
}

describe('StatementLedgerReader.normalSideFor', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('reads a debit-normal account from its balance row', async () => {
    const query = leanQuery({ normalSide: 'debit' });
    context.balances.findOne.mockReturnValue(query);

    const side = await context.reader.normalSideFor(ACCOUNT_REF, CURRENCY);

    expect(context.balances.findOne).toHaveBeenCalledWith({
      accountRef: ACCOUNT_REF,
      currency: CURRENCY,
    });
    expect(query.select).toHaveBeenCalledWith('normalSide');
    expect(side).toBe('debit');
  });

  it('treats an account never posted to as credit-normal', async () => {
    context.balances.findOne.mockReturnValue(leanQuery(null));

    await expect(context.reader.normalSideFor(ACCOUNT_REF, CURRENCY)).resolves.toBe('credit');
  });

  it('keeps a credit-normal balance row on the credit side', async () => {
    context.balances.findOne.mockReturnValue(leanQuery({ normalSide: 'credit' }));

    await expect(context.reader.normalSideFor(ACCOUNT_REF, CURRENCY)).resolves.toBe('credit');
  });
});

describe('StatementLedgerReader.totalsBefore', () => {
  it('sums everything strictly before the period opens, empty when nothing posted', async () => {
    const { reader, entries } = setup();
    entries.aggregate.mockResolvedValue([]);

    const totals = await reader.totalsBefore(ACCOUNT_REF, CURRENCY, '2026-07-01');

    expect(entries.aggregate).toHaveBeenCalledWith([
      { $match: { accountRef: ACCOUNT_REF, currency: CURRENCY, valueDate: { $lt: '2026-07-01' } } },
      expect.objectContaining({ $group: expect.objectContaining({ _id: null }) }),
    ]);
    expect(totals).toEqual(EMPTY_TOTALS);
  });
});

describe('StatementLedgerReader.totalsWithin', () => {
  it('returns the aggregated row for the inclusive window', async () => {
    const { reader, entries } = setup();
    const row = { creditMinorUnits: 20_000, debitMinorUnits: 5_000, signedMinorUnits: 15_000, count: 2 };
    entries.aggregate.mockResolvedValue([row]);

    const totals = await reader.totalsWithin(ACCOUNT_REF, CURRENCY, '2026-07-01', '2026-07-31');

    expect(entries.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          accountRef: ACCOUNT_REF,
          currency: CURRENCY,
          valueDate: { $gte: '2026-07-01', $lte: '2026-07-31' },
        },
      },
      expect.objectContaining({ $group: expect.objectContaining({ _id: null }) }),
    ]);
    expect(totals).toEqual(row);
  });
});

describe('StatementLedgerReader.linesWithin', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('queries the window in value-date order and never asks for headers when empty', async () => {
    const query = leanQuery([]);
    context.entries.find.mockReturnValue(query);

    const lines = await context.reader.linesWithin(ACCOUNT_REF, CURRENCY, '2026-07-01', '2026-07-31');

    expect(context.entries.find).toHaveBeenCalledWith({
      accountRef: ACCOUNT_REF,
      currency: CURRENCY,
      valueDate: { $gte: '2026-07-01', $lte: '2026-07-31' },
    });
    expect(query.sort).toHaveBeenCalledWith({ valueDate: 1, bookedAt: 1, _id: 1 });
    expect(context.transactions.find).not.toHaveBeenCalled();
    expect(lines).toEqual([]);
  });

  it('prefers the entry narrative, then the transaction header, then the default', async () => {
    context.entries.find.mockReturnValue(
      leanQuery([
        entryRow({ _id: 'entry-1', transactionId: 'txn-1', narrative: 'Salary — July' }),
        entryRow({ _id: 'entry-2', transactionId: 'txn-2', direction: 'debit', minorUnits: 5_000 }),
        entryRow({ _id: 'entry-3', transactionId: 'txn-9', direction: 'debit', minorUnits: 800 }),
        entryRow({ _id: 'entry-4', transactionId: 'txn-2', direction: 'credit', minorUnits: 5_000 }),
      ]),
    );
    const headers = leanQuery([{ _id: 'txn-2', description: 'Rent to landlord' }]);
    context.transactions.find.mockReturnValue(headers);

    const lines = await context.reader.linesWithin(ACCOUNT_REF, CURRENCY, '2026-07-01', '2026-07-31');

    expect(context.transactions.find).toHaveBeenCalledWith({ _id: { $in: ['txn-1', 'txn-2', 'txn-9'] } });
    expect(headers.select).toHaveBeenCalledWith('description');
    expect(lines).toEqual([
      { valueDate: '2026-07-03', description: 'Salary — July', direction: 'credit', minorUnits: 20_000 },
      { valueDate: '2026-07-03', description: 'Rent to landlord', direction: 'debit', minorUnits: 5_000 },
      { valueDate: '2026-07-03', description: 'Transaction', direction: 'debit', minorUnits: 800 },
      { valueDate: '2026-07-03', description: 'Rent to landlord', direction: 'credit', minorUnits: 5_000 },
    ]);
  });
});
