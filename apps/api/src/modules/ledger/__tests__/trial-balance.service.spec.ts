import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { GL_CASH, GL_DEPOSITS_CURRENT, listGlAccounts } from '../domain/chart-of-accounts.js';
import type { LedgerEntryDoc } from '../infrastructure/ledger.schemas.js';
import { TrialBalanceService } from '../trial-balance.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const USD_SCALE = 2;

function setup(rows: { _id: string; debit: number; credit: number }[]) {
  const entriesModel = { aggregate: vi.fn().mockResolvedValue(rows) };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TrialBalanceService(
    entriesModel as unknown as Model<LedgerEntryDoc>,
    clock,
  );
  return { service, entriesModel };
}

describe('TrialBalanceService.generate', () => {
  it('reports every GL account even when nothing has posted', async () => {
    const { service } = setup([]);

    const report = await service.generate();

    expect(report.asOf).toBe(NOW.toISOString());
    expect(report.currency).toBe('USD');
    expect(report.lines).toHaveLength(listGlAccounts().length);
    expect(report.totalDebits).toEqual({ minorUnits: 0, currency: 'USD', scale: USD_SCALE });
    expect(report.totalCredits).toEqual({ minorUnits: 0, currency: 'USD', scale: USD_SCALE });
    expect(report.balanced).toBe(true);
  });

  it('takes each balance in the account’s natural direction and proves the book', async () => {
    const { service } = setup([
      { _id: `gl:${GL_CASH}`, debit: 50_000, credit: 20_000 },
      { _id: `gl:${GL_DEPOSITS_CURRENT}`, debit: 20_000, credit: 50_000 },
    ]);

    const report = await service.generate();

    const cash = report.lines.find((line) => line.accountCode === GL_CASH);
    const deposits = report.lines.find((line) => line.accountCode === GL_DEPOSITS_CURRENT);
    expect(cash?.balance.minorUnits).toBe(30_000); // debit-normal: debit − credit
    expect(deposits?.balance.minorUnits).toBe(30_000); // credit-normal: credit − debit
    expect(report.totalDebits.minorUnits).toBe(70_000);
    expect(report.totalCredits.minorUnits).toBe(70_000);
    expect(report.balanced).toBe(true);
  });

  it('flags an out-of-balance book instead of papering over it', async () => {
    const { service } = setup([{ _id: `gl:${GL_CASH}`, debit: 5_000, credit: 0 }]);

    const report = await service.generate();

    expect(report.totalDebits.minorUnits).toBe(5_000);
    expect(report.totalCredits.minorUnits).toBe(0);
    expect(report.balanced).toBe(false);
  });

  it('aggregates GL entries only, in the requested currency', async () => {
    const { service, entriesModel } = setup([]);

    await service.generate('GHS');

    const [pipeline] = entriesModel.aggregate.mock.calls[0] as [
      { $match: { accountRef: { $regex: string }; currency: string } }[],
    ];
    expect(pipeline[0]?.$match.accountRef.$regex).toBe('^gl:');
    expect(pipeline[0]?.$match.currency).toBe('GHS');
  });
});
