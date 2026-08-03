import { fromMinorUnits, percentage, roundMinorUnits, zero, type Money } from '@icb/money';

/**
 * Fee basis calculation.
 *
 * Pure functions over a fee definition and a subject amount. All arithmetic stays in integer
 * minor units (N3): percentage and tiered results are rounded half-even exactly once, at the
 * end, so a quoted fee never drifts by a rounding fraction.
 */

export const FEE_BASES = ['flat', 'percentage', 'tiered'] as const;
export type FeeBasis = (typeof FEE_BASES)[number];

/** One band of a tiered fee: the percentage charged on the portion at or above `fromMinorUnits`. */
export interface FeeTier {
  readonly fromMinorUnits: number;
  readonly percentage: number;
}

/**
 * The persistence shape of a fee. The wire `Fee` contract drops `tiers` (tier rows are an
 * internal pricing detail), so this is the superset both the calculator and the schema use.
 */
export interface FeeDefinition {
  readonly code: string;
  readonly basis: FeeBasis;
  readonly amountMinorUnits: number | null;
  readonly percentage: number | null;
  readonly tiers: readonly FeeTier[];
  readonly minimumMinorUnits: number | null;
  readonly maximumMinorUnits: number | null;
  readonly waivedForTiers: readonly string[];
}

/**
 * The fee for a subject amount, after waivers and caps.
 * A customer whose tier is waived pays exactly zero — never "zero after rounding".
 */
export function calculateFee(
  fee: FeeDefinition,
  subject: Money,
  customerTier: string,
): Money {
  if (fee.waivedForTiers.includes(customerTier)) {
    return zero(subject.currency);
  }
  const raw = rawFee(fee, subject);
  const clamped = clamp(raw, fee.minimumMinorUnits, fee.maximumMinorUnits);
  return fromMinorUnits(clamped, subject.currency);
}

function rawFee(fee: FeeDefinition, subject: Money): number {
  switch (fee.basis) {
    case 'flat':
      return fee.amountMinorUnits ?? 0;
    case 'percentage':
      return percentage(subject, fee.percentage ?? 0).minorUnits;
    case 'tiered':
      return tieredFee(subject.minorUnits, fee.tiers);
  }
}

/** Progressive bands, like income tax: each portion of the amount is charged its band's rate. */
function tieredFee(minorUnits: number, tiers: readonly FeeTier[]): number {
  const ordered = [...tiers].sort((a, b) => a.fromMinorUnits - b.fromMinorUnits);
  let total = 0;
  for (const [index, tier] of ordered.entries()) {
    const bandEnd = ordered[index + 1]?.fromMinorUnits ?? Number.MAX_SAFE_INTEGER;
    const portion = Math.min(Math.max(minorUnits - tier.fromMinorUnits, 0), bandEnd - tier.fromMinorUnits);
    total += (portion * tier.percentage) / 100;
  }
  return roundMinorUnits(total);
}

function clamp(value: number, minimum: number | null, maximum: number | null): number {
  const floor = minimum === null ? value : Math.max(value, minimum);
  return maximum === null ? floor : Math.min(floor, maximum);
}
