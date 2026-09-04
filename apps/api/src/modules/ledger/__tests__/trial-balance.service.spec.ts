import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { listGlAccounts } from '../domain/chart-of-accounts.js';
import type { TrialBalance } from '@icb/contracts';

import type { LedgerEntryDoc } from '../infrastructure/ledger.schemas.js';
import { TrialBalanceService } from '../trial-balance.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

/** `generate` runs two aggregations — the GL half, then the customer sub-ledger. */
function makeService(glRows: unknown[], subLedgerRows: unknown[] = []) {
  const aggregate = vi
    .fn()
    .mockImplementationOnce(() => Promise.resolve(glRows))
    .mockImplementationOnce(() => Promise.resolve(subLedgerRows));
  const entries = { aggregate };
  const clock = new ClockService();
  clock.freeze(NOW);
  return {
    service: new TrialBalanceService(entries as unknown as Model<LedgerEntryDoc>, clock),
    aggregate,
  };
}

const byCode = (lines: TrialBalance['lines']) =>
  new Map(lines.map((line) => [line.accountCode, line]));

describe('TrialBalanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps every GL account, taking each balance in its natural direction', async () => {
    const { service } = makeService([
      { _id: 'gl:1000', debit: 500, credit: 200 },
      { _id: 'gl:4000', debit: 200, credit: 500 },
    ]);

    const report = await service.generate();

    expect(report.asOf).toBe(NOW.toISOString());
    expect(report.currency).toBe('USD');
    expect(report.lines).toHaveLength(listGlAccounts().length);
    const lines = byCode(report.lines);
    // Cash is debit-normal: 500 - 200.
    expect(lines.get('1000')).toMatchObject({
      accountName: 'Cash and central bank',
      type: 'asset',
      debit: { minorUnits: 500 },
      credit: { minorUnits: 200 },
      balance: { minorUnits: 300 },
    });
    // Fee income is credit-normal: 500 - 200.
    expect(lines.get('4000')?.balance).toEqual({ minorUnits: 300, currency: 'USD', scale: 2 });
    // An account with no entries shows zeroes rather than disappearing.
    expect(lines.get('9900')).toMatchObject({
      debit: { minorUnits: 0 },
      credit: { minorUnits: 0 },
      balance: { minorUnits: 0 },
    });
    expect(report.totalDebits).toEqual({ minorUnits: 700, currency: 'USD', scale: 2 });
    expect(report.totalCredits).toEqual({ minorUnits: 700, currency: 'USD', scale: 2 });
    expect(report.balanced).toBe(true);
  });

  it('rolls the customer sub-ledger into its deposit control accounts', async () => {
    // A customer deposit: cash debited on the bank's books, the customer credited on theirs.
    // Counting only the GL half reported a balanced bank as out of balance.
    const { service } = makeService(
      [{ _id: 'gl:1000', debit: 1000, credit: 0 }],
      [
        { _id: 'current', debit: 0, credit: 700 },
        { _id: 'savings', debit: 0, credit: 300 },
      ],
    );

    const report = await service.generate();

    const lines = byCode(report.lines);
    expect(lines.get('2000')?.balance).toEqual({ minorUnits: 700, currency: 'USD', scale: 2 });
    expect(lines.get('2010')?.balance).toEqual({ minorUnits: 300, currency: 'USD', scale: 2 });
    expect(report.totalDebits).toEqual({ minorUnits: 1000, currency: 'USD', scale: 2 });
    expect(report.totalCredits).toEqual({ minorUnits: 1000, currency: 'USD', scale: 2 });
    expect(report.balanced).toBe(true);
  });

  it('adds sub-ledger totals to a control account that also carries direct postings', async () => {
    const { service } = makeService(
      [{ _id: 'gl:2000', debit: 0, credit: 50 }],
      [{ _id: 'current', debit: 0, credit: 70 }],
    );

    const report = await service.generate();

    expect(byCode(report.lines).get('2000')).toMatchObject({
      credit: { minorUnits: 120 },
      balance: { minorUnits: 120 },
    });
  });

  it('parks an orphaned customer entry in suspense rather than dropping it', async () => {
    // Dropping it would silently unbalance the report; suspense is the one account the
    // integrity check requires to be zero, so an orphan cannot hide there.
    const { service } = makeService(
      [{ _id: 'gl:1000', debit: 400, credit: 0 }],
      [{ _id: null, debit: 0, credit: 400 }],
    );

    const report = await service.generate();

    expect(byCode(report.lines).get('9900')?.credit).toEqual({
      minorUnits: 400,
      currency: 'USD',
      scale: 2,
    });
    expect(report.balanced).toBe(true);
  });

  it('flags the books as unbalanced when debits and credits disagree', async () => {
    const { service } = makeService([{ _id: 'gl:1000', debit: 100, credit: 0 }]);

    const report = await service.generate();

    expect(report.balanced).toBe(false);
    expect(report.totalDebits).toEqual({ minorUnits: 100, currency: 'USD', scale: 2 });
    expect(report.totalCredits).toEqual({ minorUnits: 0, currency: 'USD', scale: 2 });
  });

  it('aggregates one currency at a time, on both halves of the ledger', async () => {
    const { service, aggregate } = makeService([], []);

    await service.generate('GHS');

    for (const [pipeline] of aggregate.mock.calls) {
      expect(pipeline[0]).toMatchObject({ $match: { currency: 'GHS' } });
    }
    expect(aggregate.mock.calls[0]?.[0][0].$match.accountRef).toEqual({ $regex: '^gl:' });
    expect(aggregate.mock.calls[1]?.[0][0].$match.accountRef).toEqual({ $regex: '^acct:' });
  });
});
