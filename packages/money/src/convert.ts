import { roundMinorUnits, type RoundingMode } from './arithmetic.js';
import { getMinorUnitFactor, type CurrencyCode } from './currency.js';
import { fromMinorUnits, type Money } from './money.js';

export interface ConversionRequest {
  readonly amount: Money;
  readonly to: CurrencyCode;
  /** Units of `to` per one unit of `amount.currency`, in major units (e.g. 1.0842 USD→EUR). */
  readonly rate: number;
  readonly mode?: RoundingMode;
}

export interface ConversionResult {
  readonly converted: Money;
  /**
   * The fraction of a minor unit lost or gained to rounding, expressed in the target currency's
   * minor units as a signed float. Positive means the bank kept a fraction; negative means it
   * gave one away. This MUST be posted to the FX rounding account (9000) so the ledger balances
   * — see agent_plan.md §4.1.
   */
  readonly roundingDelta: number;
  readonly rate: number;
}

/**
 * Convert between currencies, surfacing the rounding remainder rather than swallowing it.
 *
 * Scale differences are handled explicitly: converting 1000 JPY (scale 0) to USD (scale 2) has
 * to move the decimal point two places, and doing that implicitly is how simulated banks end up
 * a factor of 100 out.
 */
export function convert(request: ConversionRequest): ConversionResult {
  const { amount, to, rate, mode = 'half-even' } = request;

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError(`FX rate must be a positive finite number, received ${rate}`);
  }

  if (amount.currency === to) {
    return { converted: amount, roundingDelta: 0, rate: 1 };
  }

  const sourceFactor = getMinorUnitFactor(amount.currency);
  const targetFactor = getMinorUnitFactor(to);

  const exactTargetMinorUnits = (amount.minorUnits / sourceFactor) * rate * targetFactor;
  const rounded = roundMinorUnits(exactTargetMinorUnits, mode);

  return {
    converted: fromMinorUnits(rounded, to),
    roundingDelta: rounded - exactTargetMinorUnits,
    rate,
  };
}

/** Which side of the spread the customer is on, given a rate of target-per-source. */
export type SpreadSide =
  /** Customer is buying the target currency — they receive fewer target units. */
  | 'customer-buys'
  /** Customer is selling the target currency back — they receive more per unit sold. */
  | 'customer-sells';

/**
 * Apply the bank's spread to a mid-market rate. The spread always moves the rate against the
 * customer; that difference is ICB's FX income and is posted to account 4200.
 *
 * @param midRate Target units per one source unit.
 * @param spreadBps Spread in basis points (100 bps = 1%).
 */
export function applySpread(midRate: number, spreadBps: number, side: SpreadSide): number {
  if (spreadBps < 0) {
    throw new RangeError('Spread cannot be negative');
  }
  const factor = spreadBps / 10_000;
  return side === 'customer-buys' ? midRate * (1 - factor) : midRate * (1 + factor);
}
