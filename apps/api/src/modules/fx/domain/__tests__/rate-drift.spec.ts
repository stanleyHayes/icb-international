import { describe, expect, it } from 'vitest';

import { USD_PER_UNIT } from '../base-rates.js';
import {
  changePercent24h,
  driftFactor,
  historyInstants,
  midRateAt,
  usdPerUnitAt,
} from '../rate-drift.js';

const SEED = 'drift-test';
const AT = 1_800_000_000_000;

describe('driftFactor', () => {
  it('is deterministic for the same seed, currency and instant', () => {
    expect(driftFactor(SEED, 'EUR', AT)).toBe(driftFactor(SEED, 'EUR', AT));
  });

  it('stays positive and within the volatility band', () => {
    for (const at of [AT, AT + 3_600_000, AT + 86_400_000]) {
      const factor = driftFactor(SEED, 'EUR', at);
      expect(factor).toBeGreaterThan(1 - 0.012);
      expect(factor).toBeLessThan(1 + 0.012);
    }
  });
});

describe('usdPerUnitAt', () => {
  it('anchors at the base rate scaled by the drift', () => {
    const expected = USD_PER_UNIT.GBP * driftFactor(SEED, 'GBP', AT);
    expect(usdPerUnitAt(SEED, 'GBP', AT)).toBeCloseTo(expected, 10);
  });
});

describe('midRateAt', () => {
  it('is exactly 1 for a currency against itself', () => {
    expect(midRateAt(SEED, 'EUR', 'EUR', AT)).toBe(1);
  });

  it('is self-consistent through the dollar leg', () => {
    const eurUsd = midRateAt(SEED, 'EUR', 'USD', AT);
    const usdGbp = midRateAt(SEED, 'USD', 'GBP', AT);
    const eurGbp = midRateAt(SEED, 'EUR', 'GBP', AT);
    expect(eurUsd * usdGbp).toBeCloseTo(eurGbp, 6);
  });

  it('moves over time but repeats for the same instant', () => {
    const first = midRateAt(SEED, 'EUR', 'USD', AT);
    expect(midRateAt(SEED, 'EUR', 'USD', AT)).toBe(first);
    expect(midRateAt(SEED, 'EUR', 'USD', AT + 86_400_000)).not.toBe(first);
  });
});

describe('changePercent24h', () => {
  it('matches a hand-computed day-over-day move', () => {
    const previous = midRateAt(SEED, 'EUR', 'USD', AT - 24 * 3_600_000);
    const current = midRateAt(SEED, 'EUR', 'USD', AT);
    const expected = Number((((current - previous) / previous) * 100).toFixed(4));
    expect(changePercent24h(SEED, 'EUR', 'USD', AT)).toBe(expected);
  });

  it('is zero when nothing moved (same currency both sides)', () => {
    expect(changePercent24h(SEED, 'EUR', 'EUR', AT)).toBe(0);
  });
});

describe('historyInstants', () => {
  it('spans the window ending at now, oldest first', () => {
    const instants = historyInstants(AT, 4, 2);
    expect(instants).toHaveLength(4);
    expect(instants.at(-1)).toBe(AT);
    expect(instants[0]).toBe(AT - 2 * 3_600_000);
  });

  it('treats a single point as the whole span behind now', () => {
    expect(historyInstants(AT, 1, 2)).toEqual([AT - 2 * 3_600_000]);
  });
});
