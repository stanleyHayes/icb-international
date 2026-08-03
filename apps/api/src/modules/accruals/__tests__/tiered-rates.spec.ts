import { describe, expect, it } from 'vitest';

import {
  bandedInterest,
  effectiveRate,
  marginalRate,
  normaliseBands,
  type InterestBand,
} from '../domain/tiered-rates.js';

const TIERS: readonly InterestBand[] = [
  { fromMinorUnits: 0, rate: 0.02 },
  { fromMinorUnits: 500_000, rate: 0.024 },
  { fromMinorUnits: 5_000_000, rate: 0.028 },
];

describe('normaliseBands', () => {
  it('sorts unordered declarations ascending', () => {
    const bands = normaliseBands([TIERS[2]!, TIERS[0]!, TIERS[1]!]);
    expect(bands.map((band) => band.fromMinorUnits)).toEqual([0, 500_000, 5_000_000]);
  });

  it('anchors a first threshold above zero at the same rate', () => {
    const bands = normaliseBands([{ fromMinorUnits: 500_000, rate: 0.024 }]);
    expect(bands).toEqual([
      { fromMinorUnits: 0, rate: 0.024 },
      { fromMinorUnits: 500_000, rate: 0.024 },
    ]);
  });

  it('returns just the zero anchor for an empty card', () => {
    expect(normaliseBands([])).toEqual([{ fromMinorUnits: 0, rate: 0 }]);
  });
});

describe('marginalRate', () => {
  it('returns the rate of the band the balance tops out in', () => {
    expect(marginalRate(499_999, TIERS)).toBeCloseTo(0.02, 10);
    expect(marginalRate(500_000, TIERS)).toBeCloseTo(0.024, 10);
    expect(marginalRate(5_000_001, TIERS)).toBeCloseTo(0.028, 10);
  });
});

describe('bandedInterest', () => {
  it('prices a balance inside one band at that band alone', () => {
    // 400_000 × 0.02 for a full year.
    expect(bandedInterest(400_000, TIERS, 1)).toBe(8_000);
  });

  it('prices a balance across bands marginally, not at the top rate throughout', () => {
    // 600_000: 500_000 at 2% + 100_000 at 2.4% = 10_000 + 2_400.
    expect(bandedInterest(600_000, TIERS, 1)).toBe(12_400);
  });

  it('prices a balance above every band across all three', () => {
    // 6_000_000: 500_000 at 2% + 4_500_000 at 2.4% + 1_000_000 at 2.8%.
    expect(bandedInterest(6_000_000, TIERS, 1)).toBe(10_000 + 108_000 + 28_000);
  });

  it('scales linearly with the year fraction', () => {
    expect(bandedInterest(600_000, TIERS, 0.5)).toBe(6_200);
  });

  it('rounds once across the bands so partial fractions do not drift', () => {
    // 1 minor unit at 2% for one day of 365: 0.0000548 → 0, not 1 per band.
    expect(bandedInterest(1, TIERS, 1 / 365)).toBe(0);
  });

  it('returns zero for non-positive balances and fractions', () => {
    expect(bandedInterest(0, TIERS, 1)).toBe(0);
    expect(bandedInterest(600_000, TIERS, 0)).toBe(0);
  });
});

describe('effectiveRate', () => {
  it('blends the bands into the single annual rate the balance earns', () => {
    // 12_400 on 600_000 ≈ 2.0667%.
    expect(effectiveRate(600_000, TIERS)).toBeCloseTo(12_400 / 600_000, 10);
  });

  it('is zero for an empty balance', () => {
    expect(effectiveRate(0, TIERS)).toBe(0);
  });
});
