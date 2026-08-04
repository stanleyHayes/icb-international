import { describe, expect, it } from 'vitest';

import {
  bucketTimeSeries,
  percentChange,
  resolveChartState,
  rollupCategories,
  slicePercents,
} from '../lib/aggregate';

describe('resolveChartState', () => {
  it('prioritises loading over data', () => {
    expect(resolveChartState(true, true)).toBe('loading');
    expect(resolveChartState(true, false)).toBe('loading');
  });

  it('selects ready or empty from the data flag', () => {
    expect(resolveChartState(false, true)).toBe('ready');
    expect(resolveChartState(false, false)).toBe('empty');
  });
});

describe('bucketTimeSeries', () => {
  const points = [
    { date: '2026-01-02T10:00:00Z', value: 100 },
    { date: '2026-01-02T18:00:00Z', value: 120 },
    { date: '2026-01-05T09:00:00Z', value: 90 },
    { date: '2026-02-01T09:00:00Z', value: 200 },
  ];

  it('keeps the last value of each day, not a sum', () => {
    expect(bucketTimeSeries(points, 'day')).toEqual([
      { key: '2026-01-02', value: 120 },
      { key: '2026-01-05', value: 90 },
      { key: '2026-02-01', value: 200 },
    ]);
  });

  it('rolls days up to ISO weeks starting Monday', () => {
    // 2026-01-02 (Fri) and 2026-01-05 (Mon) fall in different weeks.
    expect(bucketTimeSeries(points, 'week').map((b) => b.key)).toEqual([
      '2025-12-29',
      '2026-01-05',
      '2026-01-26',
    ]);
  });

  it('rolls days up to months', () => {
    expect(bucketTimeSeries(points, 'month')).toEqual([
      { key: '2026-01', value: 90 },
      { key: '2026-02', value: 200 },
    ]);
  });

  it('sorts unordered input and drops unparseable dates', () => {
    const messy = [
      { date: '2026-03-02', value: 3 },
      { date: 'not-a-date', value: 999 },
      { date: '2026-03-01', value: 1 },
    ];
    expect(bucketTimeSeries(messy, 'day')).toEqual([
      { key: '2026-03-01', value: 1 },
      { key: '2026-03-02', value: 3 },
    ]);
  });

  it('returns an empty series for empty input', () => {
    expect(bucketTimeSeries([], 'day')).toEqual([]);
  });
});

describe('rollupCategories', () => {
  const slices = [
    { category: 'Groceries', value: 400 },
    { category: 'Rent', value: 900 },
    { category: 'Transport', value: 150 },
    { category: 'Dining', value: 120 },
    { category: 'Fees', value: 30 },
  ];

  it('passes through when within the slice budget, sorted descending', () => {
    const rolled = rollupCategories(slices.slice(0, 3), 6);
    expect(rolled.map((s) => s.category)).toEqual(['Rent', 'Groceries', 'Transport']);
  });

  it('folds the tail into an "Other" slice', () => {
    const rolled = rollupCategories(slices, 3);
    expect(rolled).toEqual([
      { category: 'Rent', value: 900 },
      { category: 'Groceries', value: 400 },
      { category: 'Other', value: 300 },
    ]);
  });

  it('drops non-positive slices', () => {
    const rolled = rollupCategories([...slices, { category: 'Refund', value: -50 }], 6);
    expect(rolled.some((s) => s.category === 'Refund')).toBe(false);
  });
});

describe('slicePercents', () => {
  it('computes shares of the total', () => {
    expect(slicePercents([{ category: 'A', value: 1 }, { category: 'B', value: 3 }])).toEqual([25, 75]);
  });

  it('returns zeros rather than NaN for a zero total', () => {
    expect(slicePercents([{ category: 'A', value: 0 }])).toEqual([0]);
  });
});

describe('percentChange', () => {
  it('computes the signed change', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(90, 100)).toBeCloseTo(-10);
  });

  it('is undefined when the comparison base is not positive', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, -50)).toBeNull();
  });
});
