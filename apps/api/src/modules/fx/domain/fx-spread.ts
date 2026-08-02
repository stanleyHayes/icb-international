import type { CustomerTier } from '@icb/contracts';
import { applySpread } from '@icb/money';

/**
 * The bank's cut, by relationship.
 *
 * Spread is where retail FX actually earns; publishing it per tier rather than burying it in a
 * "fee" is the honest version of the same economics. The difference between the mid and the
 * dealt rate is ICB's FX income and belongs in GL 4200.
 */
export const SPREAD_BPS_BY_TIER: Readonly<Record<CustomerTier, number>> = {
  standard: 90,
  plus: 65,
  premier: 45,
  private: 25,
};

export const DEFAULT_SPREAD_BPS = SPREAD_BPS_BY_TIER.standard;

/** An unknown or missing tier pays the standard spread — never a cheaper one by accident. */
export function spreadBpsForTier(tier: string | null | undefined): number {
  if (tier && tier in SPREAD_BPS_BY_TIER) {
    return SPREAD_BPS_BY_TIER[tier as CustomerTier];
  }
  return DEFAULT_SPREAD_BPS;
}

export interface DealtRates {
  /** What the bank pays for one unit of the base currency. Below mid. */
  readonly buy: number;
  /** What the bank charges for one unit of the base currency. Above mid. */
  readonly sell: number;
}

/**
 * Both sides of the quote, derived from one mid.
 *
 * The customer converting BASE→QUOTE is buying the quote currency, so they deal on `buy` and
 * receive fewer quote units than the mid implies. The spread always moves against them; that is
 * what makes it revenue rather than a rounding artefact.
 */
export function dealtRates(mid: number, spreadBps: number): DealtRates {
  return {
    buy: applySpread(mid, spreadBps, 'customer-buys'),
    sell: applySpread(mid, spreadBps, 'customer-sells'),
  };
}
