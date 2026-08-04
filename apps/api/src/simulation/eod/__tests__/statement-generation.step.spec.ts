import { describe, expect, it, vi } from 'vitest';

import { StatementGenerationStep } from '../steps/statement-generation.step.js';
import { previousPeriod } from '../steps/statement-period.js';
import { CONTEXT, accountDoc, sortedLeanQuery } from './fixtures.js';

const FIRST_OF_MONTH = { businessDate: '2026-08-01', asOf: CONTEXT.asOf };

function setup(options: {
  accounts?: ReturnType<typeof accountDoc>[];
  upserted?: number;
  openings?: { _id: string; net: number }[];
  movements?: { _id: string; net: number; debits: number; credits: number; entries: number }[];
} = {}) {
  const accounts = {
    find: vi.fn().mockReturnValue(sortedLeanQuery(options.accounts ?? [accountDoc()])),
  };
  const entries = {
    aggregate: vi
      .fn()
      .mockResolvedValueOnce(options.openings ?? [])
      .mockResolvedValueOnce(options.movements ?? []),
  };
  const statementsCollection = {
    updateOne: vi.fn().mockResolvedValue({ upsertedCount: options.upserted ?? 1 }),
  };
  const external = { statements: vi.fn().mockReturnValue(statementsCollection) };
  const step = new StatementGenerationStep(accounts as never, entries as never, external as never);
  return { step, accounts, entries, statementsCollection };
}

describe('previousPeriod', () => {
  it('covers the calendar month that just ended', () => {
    expect(previousPeriod('2026-08-01')).toEqual({
      label: '2026-07',
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('gets January right', () => {
    expect(previousPeriod('2026-01-01')).toEqual({
      label: '2025-12',
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('gets a short February right', () => {
    expect(previousPeriod('2027-03-01')).toEqual({
      label: '2027-02',
      from: '2027-02-01',
      to: '2027-02-28',
    });
  });
});

describe('StatementGenerationStep.run', () => {
  it('does nothing on any day but the first of the month', async () => {
    const { step, accounts } = setup();
    expect(await step.run({ businessDate: '2026-08-02', asOf: CONTEXT.asOf })).toBe(0);
    expect(accounts.find).not.toHaveBeenCalled();
  });

  it('writes one statement per open account and counts only new ones', async () => {
    const { step, statementsCollection } = setup({
      accounts: [accountDoc(), accountDoc({ _id: 'acct-2' })],
      upserted: 1,
    });

    expect(await step.run(FIRST_OF_MONTH)).toBe(2);
    expect(statementsCollection.updateOne).toHaveBeenCalledTimes(2);
    expect(statementsCollection.updateOne).toHaveBeenCalledWith(
      { accountId: 'acct-1', period: '2026-07' },
      expect.objectContaining({ $set: expect.objectContaining({ currency: 'USD' }) }),
      { upsert: true },
    );
  });

  it('counts a rewrite of an existing statement as no new statement', async () => {
    const { step } = setup({ upserted: 0 });
    expect(await step.run(FIRST_OF_MONTH)).toBe(0);
  });

  it('folds opening balance and turnover into the closing figure', async () => {
    const { step, statementsCollection } = setup({
      openings: [{ _id: 'acct:acct-1', net: 100_000 }],
      movements: [{ _id: 'acct:acct-1', net: -2_500, debits: 2_500, credits: 0, entries: 1 }],
    });

    await step.run(FIRST_OF_MONTH);

    expect(statementsCollection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          openingBalanceMinorUnits: 100_000,
          closingBalanceMinorUnits: 97_500,
          debitTurnoverMinorUnits: 2_500,
          creditTurnoverMinorUnits: 0,
          entryCount: 1,
        }),
      }),
      expect.anything(),
    );
  });

  it('still writes a zero-movement statement for an account with no activity', async () => {
    const { step, statementsCollection } = setup();

    await step.run(FIRST_OF_MONTH);

    expect(statementsCollection.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          openingBalanceMinorUnits: 0,
          closingBalanceMinorUnits: 0,
          entryCount: 0,
        }),
      }),
      expect.anything(),
    );
  });
});
