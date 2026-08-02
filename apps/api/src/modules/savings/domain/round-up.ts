import { fromMinorUnits, getScale, type Money } from '@icb/money';

/**
 * Round-up savings.
 *
 * A £4.30 coffee is charged at £4.30 and £0.70 is swept into the customer's goal. The maths is
 * trivial and therefore worth isolating: it is the one place where "the next whole major unit"
 * is defined, it must never round a whole amount up to the next one (a £5.00 purchase sweeps
 * nothing, not £5.00), and it has to behave on zero-decimal currencies where every purchase is
 * already whole.
 *
 * Pure functions on integer minor units.
 */

/** Sweep to the next whole major unit by default; a customer may opt into coarser multiples. */
export const DEFAULT_ROUND_UP_MULTIPLE = 1;

/** Multiples a customer is allowed to choose, in major units. */
export const ROUND_UP_MULTIPLES = [1, 2, 5, 10] as const;
export type RoundUpMultiple = (typeof ROUND_UP_MULTIPLES)[number];

/**
 * The change from `purchaseMinorUnits`, rounded up to the next multiple of a major unit.
 *
 * Returns zero — not the full multiple — when the purchase already lands on the boundary, and
 * zero for a refund or a zero-value purchase, which have no change to sweep.
 */
export function roundUpMinorUnits(
  purchaseMinorUnits: number,
  scale: number,
  multipleMajorUnits: number = DEFAULT_ROUND_UP_MULTIPLE,
): number {
  const multiple = Math.max(1, Math.trunc(multipleMajorUnits));
  const unit = 10 ** Math.max(0, Math.trunc(scale)) * multiple;

  // A zero-decimal currency swept to the nearest 1 has no fractional part to round.
  if (purchaseMinorUnits <= 0 || unit <= 1) {
    return 0;
  }

  const remainder = Math.trunc(purchaseMinorUnits) % unit;
  return remainder === 0 ? 0 : unit - remainder;
}

/** The amount the purchase is rounded *to*, i.e. what the customer's ledger sees in total. */
export function roundedTotalMinorUnits(
  purchaseMinorUnits: number,
  scale: number,
  multipleMajorUnits: number = DEFAULT_ROUND_UP_MULTIPLE,
): number {
  return (
    purchaseMinorUnits + roundUpMinorUnits(purchaseMinorUnits, scale, multipleMajorUnits)
  );
}

/** Money-typed convenience wrapper, so callers never have to look a currency's scale up. */
export function roundUpFor(
  purchase: Money,
  multipleMajorUnits: number = DEFAULT_ROUND_UP_MULTIPLE,
): Money {
  return fromMinorUnits(
    roundUpMinorUnits(purchase.minorUnits, getScale(purchase.currency), multipleMajorUnits),
    purchase.currency,
  );
}
