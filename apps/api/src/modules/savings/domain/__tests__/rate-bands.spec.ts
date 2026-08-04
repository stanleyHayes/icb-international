import { describe, expect, it } from 'vitest';

import {
  listRateBands,
  MINIMUM_DEPOSIT_MAJOR_UNITS,
  minimumDepositMinorUnits,
  MINIMUM_TERM_MONTHS,
  resolveRateBand,
} from '../rate-bands.js';

describe('listRateBands', () => {
  it('publishes every band as a money-typed minimum in the requested currency', () => {
    const bands = listRateBands('GBP');

    expect(bands).toHaveLength(21);
    expect(bands[0]).toStrictEqual({
      termMonths: 1,
      minimumAmount: { minorUnits: 50_000, currency: 'GBP', scale: 2 },
      rate: 0.025,
    });
  });

  it('converts major-unit minimums per currency, so JPY has no decimal places', () => {
    const bands = listRateBands('JPY');

    expect(bands[0]?.minimumAmount).toStrictEqual({
      minorUnits: 500,
      currency: 'JPY',
      scale: 0,
    });
  });
});

describe('minimumDepositMinorUnits', () => {
  it('scales the floor by the currency exponent', () => {
    expect(minimumDepositMinorUnits('GBP')).toBe(MINIMUM_DEPOSIT_MAJOR_UNITS * 100);
    expect(minimumDepositMinorUnits('JPY')).toBe(MINIMUM_DEPOSIT_MAJOR_UNITS);
    expect(MINIMUM_TERM_MONTHS).toBe(1);
  });
});

describe('resolveRateBand', () => {
  it('returns null when the amount is below the smallest tier', () => {
    expect(resolveRateBand(12, 49_999, 'GBP')).toBeNull();
  });

  it('returns null when the term is shorter than anything on the card', () => {
    expect(resolveRateBand(0, 10_000_000, 'GBP')).toBeNull();
  });

  it('prices an in-between term off the next shorter band', () => {
    const band = resolveRateBand(9, 1_000_000, 'GBP');

    // 9 months qualifies for the 6-month card, and £10,000 reaches the middle tier.
    expect(band).toStrictEqual({
      termMonths: 6,
      minimumAmount: { minorUnits: 500_000, currency: 'GBP', scale: 2 },
      rate: 0.0425,
    });
  });

  it('picks the highest rate the amount and term jointly reach', () => {
    expect(resolveRateBand(12, 5_000_000, 'GBP')?.rate).toBeCloseTo(0.054, 4);
    expect(resolveRateBand(60, 5_000_000, 'GBP')?.rate).toBeCloseTo(0.0665, 4);
  });

  it('qualifies on exact tier boundaries', () => {
    expect(resolveRateBand(1, 50_000, 'GBP')?.rate).toBeCloseTo(0.025, 4);
    expect(resolveRateBand(1, 500_000, 'GBP')?.rate).toBeCloseTo(0.0275, 4);
  });
});
