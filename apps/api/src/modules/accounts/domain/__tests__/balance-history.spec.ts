import { describe, expect, it } from 'vitest';

import { bucketClosingBalances, type ValueDatedEntry } from '../balance-history.js';

function entry(valueDate: string, signedMinorUnits: number): ValueDatedEntry {
  return { valueDate, signedMinorUnits };
}

describe('bucketClosingBalances — day', () => {
  it('accumulates entries into daily closes, repeating the balance on quiet days', () => {
    const points = bucketClosingBalances(
      [entry('2026-03-01', 10_000), entry('2026-03-03', -2_500)],
      '2026-03-01',
      '2026-03-04',
      'day',
    );

    expect(points).toEqual([
      { date: '2026-03-01', closingMinorUnits: 10_000 },
      { date: '2026-03-02', closingMinorUnits: 10_000 },
      { date: '2026-03-03', closingMinorUnits: 7_500 },
      { date: '2026-03-04', closingMinorUnits: 7_500 },
    ]);
  });

  it('folds entries before the window into its opening balance', () => {
    const points = bucketClosingBalances(
      [entry('2026-02-27', 50_000), entry('2026-03-02', 5_000)],
      '2026-03-01',
      '2026-03-03',
      'day',
    );

    expect(points[0]).toEqual({ date: '2026-03-01', closingMinorUnits: 50_000 });
    expect(points.at(-1)).toEqual({ date: '2026-03-03', closingMinorUnits: 55_000 });
  });

  it('ignores entries valued after the window', () => {
    const points = bucketClosingBalances(
      [entry('2026-03-01', 1_000), entry('2026-03-10', 9_999)],
      '2026-03-01',
      '2026-03-02',
      'day',
    );

    expect(points.at(-1)?.closingMinorUnits).toBe(1_000);
  });

  it('sums several entries sharing one value date', () => {
    const points = bucketClosingBalances(
      [entry('2026-03-01', 100), entry('2026-03-01', 250), entry('2026-03-01', -50)],
      '2026-03-01',
      '2026-03-01',
      'day',
    );

    expect(points).toEqual([{ date: '2026-03-01', closingMinorUnits: 300 }]);
  });
});

describe('bucketClosingBalances — week', () => {
  // 2026-03-02 is a Monday; its ISO week ends on Sunday 2026-03-08.
  it('closes each bucket on the Sunday of its ISO week', () => {
    const points = bucketClosingBalances(
      [entry('2026-03-04', 700)],
      '2026-03-02',
      '2026-03-15',
      'week',
    );

    expect(points).toEqual([
      { date: '2026-03-08', closingMinorUnits: 700 },
      { date: '2026-03-15', closingMinorUnits: 700 },
    ]);
  });

  it('starts mid-week and still closes on Sunday', () => {
    const points = bucketClosingBalances([entry('2026-03-06', 100)], '2026-03-06', '2026-03-09', 'week');

    expect(points[0]).toEqual({ date: '2026-03-08', closingMinorUnits: 100 });
  });
});

describe('bucketClosingBalances — month', () => {
  it('closes each bucket on the last day of the calendar month', () => {
    const points = bucketClosingBalances(
      [entry('2026-01-15', 1_000), entry('2026-02-28', 500)],
      '2026-01-10',
      '2026-03-05',
      'month',
    );

    expect(points).toEqual([
      { date: '2026-01-31', closingMinorUnits: 1_000 },
      { date: '2026-02-28', closingMinorUnits: 1_500 },
      // A partial final month is capped at the window end, not the month end.
      { date: '2026-03-05', closingMinorUnits: 1_500 },
    ]);
  });

  it('handles February in a leap year', () => {
    const points = bucketClosingBalances([], '2028-02-01', '2028-02-28', 'month');

    expect(points).toEqual([{ date: '2028-02-28', closingMinorUnits: 0 }]);
  });
});

describe('bucketClosingBalances — edge cases', () => {
  it('returns one point when from equals to', () => {
    const points = bucketClosingBalances([entry('2026-03-01', 42)], '2026-03-01', '2026-03-01', 'day');

    expect(points).toEqual([{ date: '2026-03-01', closingMinorUnits: 42 }]);
  });

  it('returns zero-closing points for an account with no entries', () => {
    const points = bucketClosingBalances([], '2026-03-01', '2026-03-03', 'day');

    expect(points).toHaveLength(3);
    expect(points.every((point) => point.closingMinorUnits === 0)).toBe(true);
  });

  it('does not mutate or depend on the order of its input', () => {
    const shuffled = [entry('2026-03-03', -2_500), entry('2026-03-01', 10_000)];
    const points = bucketClosingBalances(shuffled, '2026-03-01', '2026-03-03', 'day');

    expect(points.at(-1)?.closingMinorUnits).toBe(7_500);
    expect(shuffled[0]?.valueDate).toBe('2026-03-03');
  });
});
