import { roundMinorUnits } from '@icb/money';

/**
 * Tiered rate bands.
 *
 * Bands are *marginal*, like tax brackets: a balance of 60,000 against bands at 0 / 50,000
 * earns the lower rate on the first 50,000 and the higher rate only on the excess. Marginal
 * pricing means a customer one unit over a threshold gains a better rate on the overflow,
 * not a windfall on the whole balance — and the published tiers can never punish a deposit
 * for crossing one.
 *
 * Pure functions: integer minor units in and out, rounding once at the end so partial-band
 * fractions do not drift.
 */

/** One tier: balances from `fromMinorUnits` upward earn `rate` (annual nominal, a fraction). */
export interface InterestBand {
  readonly fromMinorUnits: number;
  readonly rate: number;
}

/**
 * Sort ascending and drop degenerate tiers. Callers declare bands in any order; the maths
 * below relies on ascending, zero-anchored thresholds.
 */
export function normaliseBands(bands: readonly InterestBand[]): InterestBand[] {
  const sorted = [...bands].sort((left, right) => left.fromMinorUnits - right.fromMinorUnits);
  if (sorted.length > 0 && sorted[0]?.fromMinorUnits === 0) {
    return sorted;
  }
  // A first threshold above zero implicitly starts at zero at the same rate.
  return [{ fromMinorUnits: 0, rate: sorted[0]?.rate ?? 0 }, ...sorted];
}

/** The marginal rate a balance of this size earns on its top unit. */
export function marginalRate(balanceMinorUnits: number, bands: readonly InterestBand[]): number {
  const ordered = normaliseBands(bands);
  let rate = 0;
  for (const band of ordered) {
    if (band.fromMinorUnits <= balanceMinorUnits) {
      rate = band.rate;
    }
  }
  return rate;
}

/**
 * Interest over `fractionOfYear` across all bands, marginal per band, rounded once.
 *
 * Each band contributes `portion × rate × fraction`; the portions always re-sum to the
 * balance, so nothing is gained or lost at the seams.
 */
export function bandedInterest(
  balanceMinorUnits: number,
  bands: readonly InterestBand[],
  fractionOfYear: number,
): number {
  if (balanceMinorUnits <= 0 || fractionOfYear <= 0) {
    return 0;
  }
  const ordered = normaliseBands(bands);

  let accrued = 0;
  for (const [index, band] of ordered.entries()) {
    const ceiling = ordered[index + 1]?.fromMinorUnits ?? Number.POSITIVE_INFINITY;
    const portion = Math.min(balanceMinorUnits, ceiling) - band.fromMinorUnits;
    if (portion > 0) {
      accrued += portion * band.rate * fractionOfYear;
    }
  }
  return roundMinorUnits(accrued, 'half-even');
}

/**
 * The blended annual rate a balance earns across its bands — interest for a full year
 * divided by the balance. Recorded on the accrual row so the figure can be re-derived
 * without knowing the band table.
 */
export function effectiveRate(balanceMinorUnits: number, bands: readonly InterestBand[]): number {
  if (balanceMinorUnits <= 0) {
    return 0;
  }
  return bandedInterest(balanceMinorUnits, bands, 1) / balanceMinorUnits;
}
