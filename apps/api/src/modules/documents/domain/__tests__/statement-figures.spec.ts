import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../../common/errors/index.js';
import { buildStatementFigures, type EntryTotals, type StatementScope } from '../statement-figures.js';

const SCOPE: StatementScope = {
  accountId: 'acct-1',
  from: '2026-07-01',
  to: '2026-07-31',
  currency: 'GBP',
};

function totals(overrides: Partial<EntryTotals> = {}): EntryTotals {
  return { creditMinorUnits: 0, debitMinorUnits: 0, signedMinorUnits: 0, count: 0, ...overrides };
}

describe('buildStatementFigures', () => {
  it('flips the signed effects for a debit-normal account so debits read as money out', () => {
    const before = totals({ debitMinorUnits: 100_000, signedMinorUnits: 100_000, count: 1 });
    const period = totals({ debitMinorUnits: 30_000, signedMinorUnits: 30_000, count: 1 });

    const figures = buildStatementFigures(before, period, 'debit', SCOPE);

    expect(figures).toEqual({
      openingMinorUnits: -100_000,
      closingMinorUnits: -130_000,
      totalCreditsMinorUnits: 0,
      totalDebitsMinorUnits: 30_000,
      transactionCount: 1,
    });
  });

  it('refuses to issue when opening plus turnover does not reach the closing figure', () => {
    const before = totals({ creditMinorUnits: 100_000, signedMinorUnits: 100_000, count: 1 });
    const period = totals({ creditMinorUnits: 10_000, signedMinorUnits: 5_000, count: 1 });

    let thrown: unknown;
    try {
      buildStatementFigures(before, period, 'credit', SCOPE);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(DomainError);
    const error = thrown as DomainError;
    expect(error.code).toBe('LEDGER_UNBALANCED');
    expect(error.context).toMatchObject({
      ...SCOPE,
      openingMinorUnits: 100_000,
      closingMinorUnits: 105_000,
      differenceMinorUnits: 5_000,
    });
  });
});
