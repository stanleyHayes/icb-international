import { BENEFICIARY_COOLING_OFF_HOURS } from '@icb/contracts';
import { fromMinorUnits, getMinorUnitFactor, type CurrencyCode, type Money } from '@icb/money';

/**
 * The cooling-off window.
 *
 * A brand-new payee is capped rather than blocked outright: the customer who genuinely just
 * added their landlord can still send a deposit, while an attacker who added a mule account
 * cannot move the balance in one shot. The window expires on its own — nobody has to remember to
 * lift it — and the cap is denominated in the currency being sent so it means the same thing
 * whether the payment is in USD or JPY.
 */

const MS_PER_HOUR = 3_600_000;

/** Ceiling while the payee is inside its cooling-off window, in major units. */
export const COOLING_OFF_CAP_MAJOR_UNITS = 100;

/** Ceiling once the window has passed but the payee still has not been verified. */
export const UNVERIFIED_CAP_MAJOR_UNITS = 1_000;

export function coolingOffEndsAt(addedAt: Date): Date {
  return new Date(addedAt.getTime() + BENEFICIARY_COOLING_OFF_HOURS * MS_PER_HOUR);
}

export function isCoolingOff(coolingOffUntil: Date | null, now: Date): boolean {
  return coolingOffUntil !== null && now.getTime() < coolingOffUntil.getTime();
}

/**
 * A cap expressed in a currency's own minor units.
 *
 * Multiplying by the minor-unit factor rather than by 100 is what keeps the rule honest for JPY
 * (scale 0) and KWD (scale 3), where a hard-coded 100 would be out by two or three orders of
 * magnitude in opposite directions.
 */
export function capFor(majorUnits: number, currency: CurrencyCode): Money {
  return fromMinorUnits(majorUnits * getMinorUnitFactor(currency), currency);
}
