import { describe, expect, it } from 'vitest';

import {
  bucketKey,
  bucketSeries,
  buildCashflowPoints,
  previousWindow,
  seriesStart,
  summariseSpend,
  trailingWindow,
} from '../analytics.js';

describe('windows', () => {
  it('trailingWindow covers the given number of days ending today', () => {
    expect(trailingWindow('2026-02-01', 30)).toEqual({ from: '2026-01-03', to: '2026-02-01' });
  });

  it('previousWindow is the same length, immediately before', () => {
    expect(previousWindow('2026-01-10', '2026-01-19')).toEqual({
      from: '2025-12-31',
      to: '2026-01-09',
    });
  });
});

describe('summariseSpend', () => {
  it('groups by category, computes shares, and sorts largest first', () => {
    const result = summariseSpend(
      [
        { category: 'groceries', minorUnits: 6_000 },
        { category: 'dining', minorUnits: 2_000 },
        { category: 'groceries', minorUnits: 2_000 },
      ],
      [],
    );

    expect(result.map((row) => row.category)).toEqual(['groceries', 'dining']);
    expect(result[0]).toMatchObject({ minorUnits: 8_000, share: 0.8, transactionCount: 2 });
  });

  it('diffs against the previous period, null where there was none', () => {
    const result = summariseSpend(
      [
        { category: 'groceries', minorUnits: 1_500 },
        { category: 'travel', minorUnits: 500 },
      ],
      [{ category: 'groceries', minorUnits: 1_000 }],
    );

    expect(result.find((row) => row.category === 'groceries')?.changeFromPreviousPeriod).toBe(0.5);
    expect(result.find((row) => row.category === 'travel')?.changeFromPreviousPeriod).toBeNull();
  });
});

describe('bucketKey', () => {
  it('uses YYYY-MM for months', () => {
    expect(bucketKey('2026-08-19', 'month')).toBe('2026-08');
  });

  it('uses the Monday of the week for weeks', () => {
    // 2026-08-02 is a Sunday; its Monday is 2026-07-27.
    expect(bucketKey('2026-08-02', 'week')).toBe('2026-07-27');
    expect(bucketKey('2026-07-27', 'week')).toBe('2026-07-27');
  });
});

describe('bucketSeries', () => {
  it('builds a month series ending in the current month, oldest first', () => {
    const series = bucketSeries('2026-02-14', 'month', 3);

    expect(series).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('builds a week series of Mondays ending in the current week', () => {
    const series = bucketSeries('2026-08-02', 'week', 3);

    expect(series).toEqual(['2026-07-13', '2026-07-20', '2026-07-27']);
  });

  it('seriesStart is the first covered calendar day', () => {
    expect(seriesStart(['2025-12', '2026-01'], 'month')).toBe('2025-12-01');
    expect(seriesStart(['2026-07-13'], 'week')).toBe('2026-07-13');
  });
});

describe('buildCashflowPoints', () => {
  it('folds rows into their buckets and nets income against expense', () => {
    const points = buildCashflowPoints(
      [
        { valueDate: '2026-01-05', direction: 'credit', minorUnits: 300_000 },
        { valueDate: '2026-01-12', direction: 'debit', minorUnits: 80_000 },
        { valueDate: '2026-02-03', direction: 'debit', minorUnits: 20_000 },
      ],
      ['2026-01', '2026-02'],
      'month',
    );

    expect(points).toEqual([
      { period: '2026-01', incomeMinorUnits: 300_000, expenseMinorUnits: 80_000, netMinorUnits: 220_000 },
      { period: '2026-02', incomeMinorUnits: 0, expenseMinorUnits: 20_000, netMinorUnits: -20_000 },
    ]);
  });

  it('fills buckets that saw no activity with zeros', () => {
    const points = buildCashflowPoints([], ['2026-01', '2026-02'], 'month');

    expect(points).toHaveLength(2);
    expect(points.every((point) => point.netMinorUnits === 0)).toBe(true);
  });
});
