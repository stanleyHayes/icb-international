import { describe, expect, it } from 'vitest';

import { interestForPeriod, yearFraction } from '../domain/day-count.js';

describe('yearFraction', () => {
  it('counts actual days over a fixed 365-day year under ACT/365', () => {
    expect(yearFraction('ACT/365', '2026-01-01', '2026-01-02')).toBeCloseTo(1 / 365, 10);
    expect(yearFraction('ACT/365', '2026-01-01', '2027-01-01')).toBeCloseTo(1, 10);
  });

  it('counts a leap day as a real day under ACT/365', () => {
    // 2028 is a leap year: 366 actual days, still over 365.
    expect(yearFraction('ACT/365', '2028-01-01', '2029-01-01')).toBeCloseTo(366 / 365, 10);
  });

  it('counts actual days over a 360-day year under ACT/360', () => {
    expect(yearFraction('ACT/360', '2026-01-01', '2026-01-02')).toBeCloseTo(1 / 360, 10);
    expect(yearFraction('ACT/360', '2026-01-01', '2027-01-01')).toBeCloseTo(365 / 360, 10);
  });

  it('treats every month as thirty days under 30/360', () => {
    expect(yearFraction('30/360', '2026-01-15', '2026-02-15')).toBeCloseTo(30 / 360, 10);
    expect(yearFraction('30/360', '2026-01-01', '2027-01-01')).toBeCloseTo(1, 10);
  });

  it('pulls the 31st back to the 30th under 30/360', () => {
    // The convention's quirk: 30 Jan → 31 Jan is zero days, and 31 Jan → 1 Feb is one.
    expect(yearFraction('30/360', '2026-01-30', '2026-01-31')).toBe(0);
    expect(yearFraction('30/360', '2026-01-31', '2026-02-01')).toBeCloseTo(1 / 360, 10);
    // 28 Feb → 1 Mar is three days; a full February is thirty however long it really is.
    expect(yearFraction('30/360', '2026-02-28', '2026-03-01')).toBeCloseTo(3 / 360, 10);
    expect(yearFraction('30/360', '2026-02-01', '2026-03-01')).toBeCloseTo(30 / 360, 10);
  });

  it('prices a single day identically under ACT/360 and 30/360', () => {
    expect(yearFraction('ACT/360', '2026-06-10', '2026-06-11')).toBeCloseTo(
      yearFraction('30/360', '2026-06-10', '2026-06-11'),
      10,
    );
  });
});

describe('interestForPeriod', () => {
  it('computes one day of ACT/365 interest, rounded to a whole minor unit', () => {
    // 1,000,000.00 at 5% for one day: 100_000_000 × 0.05 / 365 ≈ 13_698.63 → 13_699.
    expect(interestForPeriod(100_000_000, 0.05, 'ACT/365', '2026-01-01', '2026-01-02')).toBe(
      13_699,
    );
  });

  it('computes one day of ACT/360 interest', () => {
    // 100_000_000 × 0.05 / 360 ≈ 13_888.89 → 13_889.
    expect(interestForPeriod(100_000_000, 0.05, 'ACT/360', '2026-01-01', '2026-01-02')).toBe(
      13_889,
    );
  });

  it('computes 30/360 interest over an exact year', () => {
    expect(interestForPeriod(10_000_000, 0.06, '30/360', '2026-01-01', '2027-01-01')).toBe(
      600_000,
    );
  });

  it('rounds half-even, never silently up', () => {
    // 1_000 × 0.05 / 365 ≈ 0.137 — sub-unit interest accrues to zero, not to one.
    expect(interestForPeriod(1_000, 0.05, 'ACT/365', '2026-01-01', '2026-01-02')).toBe(0);
  });

  it('returns zero for non-positive balances, rates, and periods', () => {
    expect(interestForPeriod(0, 0.05, 'ACT/365', '2026-01-01', '2026-01-02')).toBe(0);
    expect(interestForPeriod(1_000_000, 0, 'ACT/365', '2026-01-01', '2026-01-02')).toBe(0);
    expect(interestForPeriod(1_000_000, 0.05, 'ACT/365', '2026-01-02', '2026-01-01')).toBe(0);
  });
});
