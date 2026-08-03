import { getScale, type CurrencyCode } from '@icb/money';

import {
  type CapitalisationSchedule,
  type DayCountConvention,
} from '../accruals.constants.js';
import type { InterestBand } from './tiered-rates.js';

/**
 * Accrual policy: which convention, which rate bands, and which capitalisation schedule each
 * account kind accrues under.
 *
 *  - current       — ACT/360, the money-market convention current accounts are priced on.
 *  - savings       — ACT/365, matching the retail convention the savings module quotes.
 *  - fixed_deposit — ACT/365, matching the deposits module's maturity maths; `at_maturity`
 *    capitalisation, because the deposits lifecycle posts the interest, not this engine.
 *
 * An explicit rate on the account always wins over the tiered default: a negotiated rate is a
 * single flat band. Band thresholds are declared in major units and converted per currency,
 * so the policy is meaningful for a zero-decimal currency without a second table.
 */

export interface AccrualPolicy {
  readonly basis: DayCountConvention;
  readonly bands: readonly InterestBand[];
  readonly capitalisation: CapitalisationSchedule;
}

interface KindPolicy {
  readonly basis: DayCountConvention;
  /** `[threshold in major units, annual rate]` pairs, ascending. */
  readonly tiers: readonly (readonly [number, number])[];
  readonly capitalisation: CapitalisationSchedule;
}

const CURRENT_DEFAULT_RATE = 0.005;
const FIXED_DEPOSIT_DEFAULT_RATE = 0.03;

const SAVINGS_TIERS: readonly (readonly [number, number])[] = [
  [0, 0.02],
  [5_000, 0.024],
  [50_000, 0.028],
];

const KIND_POLICIES: Readonly<Record<string, KindPolicy>> = {
  current: {
    basis: 'ACT/360',
    tiers: [[0, CURRENT_DEFAULT_RATE]],
    capitalisation: 'monthly',
  },
  savings: {
    basis: 'ACT/365',
    tiers: SAVINGS_TIERS,
    capitalisation: 'monthly',
  },
  fixed_deposit: {
    basis: 'ACT/365',
    tiers: [[0, FIXED_DEPOSIT_DEFAULT_RATE]],
    capitalisation: 'at_maturity',
  },
};

function toBands(tiers: readonly (readonly [number, number])[], currency: CurrencyCode): InterestBand[] {
  return tiers.map(([majorUnits, rate]) => ({
    fromMinorUnits: majorUnits * 10 ** getScale(currency),
    rate,
  }));
}

/**
 * The policy an account accrues under, or null when its kind does not bear interest.
 * `rateOverride` (the account's own `interestRate`) replaces the tier card with a flat band.
 */
export function policyFor(
  kind: string,
  currency: CurrencyCode,
  rateOverride: number | null,
): AccrualPolicy | null {
  const policy = KIND_POLICIES[kind];
  if (!policy) {
    return null;
  }
  const bands =
    rateOverride !== null && rateOverride > 0
      ? [{ fromMinorUnits: 0, rate: rateOverride }]
      : toBands(policy.tiers, currency);
  return { basis: policy.basis, bands, capitalisation: policy.capitalisation };
}
