import type { KycLevel, KycTierLimits } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';

/**
 * KYC tiers, as data.
 *
 * A tier is not a compliance label — it is an enforceable ceiling. The transfer pipeline reads
 * these limits before it moves a cent, so an under-verified customer physically cannot exceed
 * their band. Holding the numbers in one exported table (rather than scattered through the
 * services that enforce them) means "what may a tier-2 customer do?" has exactly one answer.
 *
 * All figures are USD minor units.
 */

const USD = 'USD';

/** Verified identity only: a wallet, not a bank account. */
const TIER_1: KycTierLimits = {
  level: 'tier_1',
  singleTransfer: toMoneyDto(50_000, USD),
  dailyTransfer: toMoneyDto(100_000, USD),
  monthlyTransfer: toMoneyDto(500_000, USD),
  maxBalance: toMoneyDto(1_000_000, USD),
  internationalAllowed: false,
};

/** Identity plus a verified address: full domestic banking, no cross-border. */
const TIER_2: KycTierLimits = {
  level: 'tier_2',
  singleTransfer: toMoneyDto(500_000, USD),
  dailyTransfer: toMoneyDto(1_000_000, USD),
  monthlyTransfer: toMoneyDto(5_000_000, USD),
  maxBalance: null,
  internationalAllowed: false,
};

/** Enhanced due diligence completed: international rails unlocked. */
const TIER_3: KycTierLimits = {
  level: 'tier_3',
  singleTransfer: toMoneyDto(10_000_000, USD),
  dailyTransfer: toMoneyDto(25_000_000, USD),
  monthlyTransfer: toMoneyDto(100_000_000, USD),
  maxBalance: null,
  internationalAllowed: true,
};

export const KYC_TIER_LIMITS: Readonly<Record<KycLevel, KycTierLimits>> = {
  tier_1: TIER_1,
  tier_2: TIER_2,
  tier_3: TIER_3,
};

/**
 * The limits for a level. An unverified customer (`null` level) is held to tier 1 — the floor,
 * never an absence of limits, so a missing KYC record can never open the taps.
 */
export function getLimitsFor(level: KycLevel | null): KycTierLimits {
  return level === null ? TIER_1 : KYC_TIER_LIMITS[level];
}

/** Every tier, lowest first — for the "upgrade your account" screen. */
export function listTierLimits(): KycTierLimits[] {
  return [TIER_1, TIER_2, TIER_3];
}
