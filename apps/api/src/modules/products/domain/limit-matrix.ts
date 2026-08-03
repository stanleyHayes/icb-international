import type { KycLevel } from '@icb/contracts';

/**
 * Limit matrices: per product, per KYC tier.
 *
 * All amounts are integer minor units in the product's primary currency. A `null` limit means
 * "uncapped" for that dimension — the customer's KYC-tier ceiling (see kyc/domain/tier-limits)
 * still applies on top, so a product cannot widen what verification allows, only narrow it.
 */

export const FALLBACK_KYC_LEVEL: KycLevel = 'tier_1';

export interface ProductLimitRow {
  readonly kycLevel: KycLevel;
  readonly singleTransactionMinorUnits: number | null;
  readonly dailyMinorUnits: number | null;
  readonly monthlyMinorUnits: number | null;
  readonly maxBalanceMinorUnits: number | null;
  readonly overdraftMinorUnits: number;
}

/**
 * The limits a customer at `level` gets on this product.
 *
 * An unverified customer (`null`) is held to the tier-1 row — the floor, matching the KYC
 * module's stance that a missing record never opens the taps. A tier with no explicit row also
 * falls back to tier 1 rather than silently becoming uncapped.
 */
export function resolveLimits(
  matrix: readonly ProductLimitRow[],
  level: KycLevel | null,
): ProductLimitRow | null {
  const effective = level ?? FALLBACK_KYC_LEVEL;
  return findRow(matrix, effective) ?? findRow(matrix, FALLBACK_KYC_LEVEL);
}

function findRow(
  matrix: readonly ProductLimitRow[],
  level: KycLevel,
): ProductLimitRow | null {
  return matrix.find((row) => row.kycLevel === level) ?? null;
}
