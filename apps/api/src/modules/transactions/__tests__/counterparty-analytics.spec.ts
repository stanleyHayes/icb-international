import { describe, expect, it } from 'vitest';

import {
  detectRecurring,
  topCounterparties,
  type CounterpartyRow,
} from '../domain/counterparty-analytics.js';

function row(overrides: Partial<CounterpartyRow> = {}): CounterpartyRow {
  return {
    name: 'Netflix',
    category: 'entertainment',
    minorUnits: 1_299,
    valueDate: '2026-06-01',
    bookedAt: '2026-06-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('topCounterparties', () => {
  it('totals per counterparty and sorts by spend, largest first', () => {
    const rows = [
      row({ name: 'Corner Cafe', minorUnits: 450 }),
      row({ name: 'Netflix', minorUnits: 1_299 }),
      row({ name: 'Corner Cafe', minorUnits: 520, valueDate: '2026-06-03' }),
    ];

    const top = topCounterparties(rows, 10);

    expect(top).toEqual([
      { name: 'Netflix', category: 'entertainment', minorUnits: 1_299, transactionCount: 1 },
      { name: 'Corner Cafe', category: 'entertainment', minorUnits: 970, transactionCount: 2 },
    ]);
  });

  it('caps the leaderboard at the requested limit', () => {
    const rows = ['a', 'b', 'c'].map((name, index) =>
      row({ name, minorUnits: 100 * (index + 1) }),
    );

    expect(topCounterparties(rows, 2).map((entry) => entry.name)).toEqual(['c', 'b']);
  });
});

describe('detectRecurring', () => {
  const monthly = (month: string, amount = 1_299): CounterpartyRow =>
    row({
      minorUnits: amount,
      valueDate: `2026-${month}-01`,
      bookedAt: `2026-${month}-01T08:00:00.000Z`,
    });

  it('flags a stable monthly charge at three occurrences', () => {
    const charges = detectRecurring([monthly('04'), monthly('05'), monthly('06')]);

    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      name: 'Netflix',
      minorUnits: 1_299,
      occurrences: 3,
      lastChargedAt: '2026-06-01T08:00:00.000Z',
    });
  });

  it('tolerates amount drift within 15%', () => {
    const charges = detectRecurring([monthly('04', 1_299), monthly('05', 1_350), monthly('06', 1_320)]);

    expect(charges).toHaveLength(1);
    expect(charges[0]?.minorUnits).toBe(1_320);
  });

  it('ignores charges that never leave a single month', () => {
    const rows = [monthly('06'), monthly('06'), monthly('06')];

    expect(detectRecurring(rows)).toEqual([]);
  });

  it('ignores drifting amounts beyond the tolerance', () => {
    const rows = [monthly('04', 1_000), monthly('05', 1_500), monthly('06', 2_000)];

    expect(detectRecurring(rows)).toEqual([]);
  });

  it('trusts the subscriptions category outright', () => {
    const rows = [
      monthly('06', 500),
      monthly('06', 900),
      monthly('06', 1_400),
    ].map((entry) => ({ ...entry, category: 'subscriptions' }));

    expect(detectRecurring(rows)).toHaveLength(1);
  });

  it('requires at least three occurrences', () => {
    expect(detectRecurring([monthly('05'), monthly('06')])).toEqual([]);
  });

  it('sorts by the expected amount, largest first', () => {
    const rows = [
      ...['04', '05', '06'].map((month) => ({ ...monthly(month, 1_299), name: 'Netflix' })),
      ...['04', '05', '06'].map((month) => ({
        ...monthly(month, 450),
        name: 'Corner Cafe',
        bookedAt: `2026-${month}-02T08:00:00.000Z`,
      })),
    ];

    expect(detectRecurring(rows).map((charge) => charge.name)).toEqual(['Netflix', 'Corner Cafe']);
  });
});
