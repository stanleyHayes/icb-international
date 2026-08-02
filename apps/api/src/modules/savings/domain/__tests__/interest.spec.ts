import { describe, expect, it } from 'vitest';

import { addMonths, daysBetween } from '../date-maths.js';
import {
  accruedInterestMinorUnits,
  accruedInterestOn,
  breakForfeitShare,
  dailyInterestMinorUnits,
  DAYS_PER_YEAR,
  elapsedDays,
  elapsedFraction,
  maturityValueMinorUnits,
  projectedInterestMinorUnits,
  quoteBreak,
  termDays,
  type DepositTerms,
} from '../interest.js';

/** £10,000.00 at 5.00% for a calendar year, opened on a date that is not a month end. */
const oneYear: DepositTerms = {
  principalMinorUnits: 1_000_000,
  rate: 0.05,
  openedOn: '2026-01-01',
  maturesOn: '2027-01-01',
};

describe('daily accrual', () => {
  it('divides the annual coupon by exactly 365 and leaves it fractional', () => {
    expect(dailyInterestMinorUnits(1_000_000, 0.05)).toBeCloseTo(50_000 / DAYS_PER_YEAR, 10);
  });

  it('earns nothing on a zero principal or a zero rate', () => {
    expect(dailyInterestMinorUnits(0, 0.05)).toBe(0);
    expect(dailyInterestMinorUnits(1_000_000, 0)).toBe(0);
    expect(dailyInterestMinorUnits(-1_000_000, 0.05)).toBe(0);
  });

  it('rounds once at the end rather than once per day', () => {
    // 1,000,000 × 5% × 30/365 = 4,109.589 minor units.
    expect(accruedInterestMinorUnits(1_000_000, 0.05, 30)).toBe(4_110);

    // Rounding each day instead of once loses three minor units a month on this deposit — which
    // exactly why the accrual job posts the cumulative figure minus what it has already paid.
    const roundedPerDay = Math.round(dailyInterestMinorUnits(500_000, 0.03));
    expect(roundedPerDay * 30).toBe(1_230);
    expect(accruedInterestMinorUnits(500_000, 0.03, 30)).toBe(1_233);
  });

  it('pays exactly the annual coupon over 365 days', () => {
    expect(accruedInterestMinorUnits(1_000_000, 0.05, DAYS_PER_YEAR)).toBe(50_000);
  });

  it('accrues nothing for a non-positive number of days', () => {
    expect(accruedInterestMinorUnits(1_000_000, 0.05, 0)).toBe(0);
    expect(accruedInterestMinorUnits(1_000_000, 0.05, -5)).toBe(0);
  });
});

describe('ACT/365 day counting', () => {
  it('counts the actual days in the term, so a leap year pays 366 days of interest', () => {
    const leap: DepositTerms = {
      ...oneYear,
      openedOn: '2028-01-01',
      maturesOn: '2029-01-01',
    };
    expect(termDays(oneYear)).toBe(365);
    expect(termDays(leap)).toBe(366);
    expect(projectedInterestMinorUnits(leap)).toBeGreaterThan(
      projectedInterestMinorUnits(oneYear),
    );
  });

  it('clamps elapsed days to the term, so a matured deposit stops earning', () => {
    expect(elapsedDays(oneYear, '2025-06-01')).toBe(0);
    expect(elapsedDays(oneYear, '2026-01-01')).toBe(0);
    expect(elapsedDays(oneYear, '2026-04-01')).toBe(90);
    expect(elapsedDays(oneYear, '2030-01-01')).toBe(365);
    expect(accruedInterestOn(oneYear, '2030-01-01')).toBe(50_000);
  });

  it('matures on the calendar date, clamping to the end of a short month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 12)).toBe('2027-01-31');
    expect(daysBetween('2026-01-31', addMonths('2026-01-31', 1))).toBe(28);
  });
});

describe('projection', () => {
  it('quotes principal plus full-term interest as the maturity value', () => {
    expect(projectedInterestMinorUnits(oneYear)).toBe(50_000);
    expect(maturityValueMinorUnits(oneYear)).toBe(1_050_000);
  });

  it('reports how far through the term a date falls', () => {
    expect(elapsedFraction(oneYear, '2026-01-01')).toBe(0);
    expect(elapsedFraction(oneYear, '2026-07-02')).toBeCloseTo(182 / 365, 6);
    expect(elapsedFraction(oneYear, '2027-06-01')).toBe(1);
  });

  it('treats a same-day maturity as fully elapsed rather than dividing by zero', () => {
    const sameDay: DepositTerms = { ...oneYear, maturesOn: '2026-01-01' };
    expect(elapsedFraction(sameDay, '2026-01-01')).toBe(1);
    expect(projectedInterestMinorUnits(sameDay)).toBe(0);
  });
});

describe('early-break penalty ladder', () => {
  it('forfeits less the closer the deposit is to maturity', () => {
    expect(breakForfeitShare(0)).toBe(1);
    expect(breakForfeitShare(0.24)).toBe(1);
    expect(breakForfeitShare(0.25)).toBe(0.75);
    expect(breakForfeitShare(0.6)).toBe(0.5);
    expect(breakForfeitShare(0.8)).toBeCloseTo(0.2, 10);
    expect(breakForfeitShare(1)).toBeCloseTo(0.2, 10);
  });

  it('clamps an out-of-range fraction instead of falling off the ladder', () => {
    expect(breakForfeitShare(-4)).toBe(1);
    expect(breakForfeitShare(9)).toBeCloseTo(0.2, 10);
  });
});

describe('break quote', () => {
  it('forfeits all accrued interest when broken in the first quarter of the term', () => {
    const quote = quoteBreak(oneYear, '2026-04-01');

    expect(quote.accruedInterestMinorUnits).toBe(12_329);
    expect(quote.forfeitShare).toBe(1);
    expect(quote.penaltyMinorUnits).toBe(12_329);
    expect(quote.netInterestMinorUnits).toBe(0);
    expect(quote.netProceedsMinorUnits).toBe(1_000_000);
    expect(quote.interestForfeitedMinorUnits).toBe(50_000);
  });

  it('forfeits half the accrued interest three quarters of the way through', () => {
    const quote = quoteBreak(oneYear, '2026-10-01');

    expect(quote.accruedInterestMinorUnits).toBe(37_397);
    expect(quote.forfeitShare).toBe(0.5);
    expect(quote.penaltyMinorUnits).toBe(18_699);
    expect(quote.netInterestMinorUnits).toBe(18_698);
    expect(quote.netProceedsMinorUnits).toBe(1_018_698);
    // Held to maturity the deposit would have paid 50,000; breaking keeps 18,698.
    expect(quote.interestForfeitedMinorUnits).toBe(50_000 - 18_698);
  });

  it('never puts the principal at risk and never forfeits more than was earned', () => {
    for (const on of ['2026-01-01', '2026-02-14', '2026-06-30', '2026-12-31', '2027-01-01']) {
      const quote = quoteBreak(oneYear, on);
      expect(quote.penaltyMinorUnits).toBeLessThanOrEqual(quote.accruedInterestMinorUnits);
      expect(quote.netProceedsMinorUnits).toBeGreaterThanOrEqual(oneYear.principalMinorUnits);
      expect(
        quote.principalMinorUnits + quote.accruedInterestMinorUnits - quote.penaltyMinorUnits,
      ).toBe(quote.netProceedsMinorUnits);
    }
  });

  it('is deterministic: the same deposit and date always price identically', () => {
    expect(quoteBreak(oneYear, '2026-08-15')).toStrictEqual(quoteBreak(oneYear, '2026-08-15'));
  });

  it('costs nothing to break on the day it was opened', () => {
    const quote = quoteBreak(oneYear, '2026-01-01');
    expect(quote.accruedInterestMinorUnits).toBe(0);
    expect(quote.penaltyMinorUnits).toBe(0);
    expect(quote.netProceedsMinorUnits).toBe(oneYear.principalMinorUnits);
  });
});
