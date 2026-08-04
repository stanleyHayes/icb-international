import { getMinorUnitFactor, getScale, isCurrencyCode, type CurrencyCode } from './currency.js';
import { AmountOverflowError, InvalidAmountError } from './errors.js';

/**
 * A monetary amount, stored as integer minor units.
 *
 * `minorUnits` is authoritative everywhere in ICB. Floating point is never used to hold a
 * balance — see agent_plan.md N3.
 */
export interface Money {
  readonly minorUnits: number;
  readonly currency: CurrencyCode;
}

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

function assertSafeMinorUnits(minorUnits: number): void {
  if (!Number.isFinite(minorUnits) || !Number.isInteger(minorUnits)) {
    throw new InvalidAmountError(minorUnits, 'minor units must be a finite integer');
  }
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AmountOverflowError(minorUnits);
  }
}

/** Construct from integer minor units. The primary constructor — prefer it everywhere. */
export function fromMinorUnits(minorUnits: number, currency: CurrencyCode): Money {
  assertSafeMinorUnits(minorUnits);
  // `+ 0` collapses -0 to 0 and leaves every other value alone. Negative zero is arithmetically
  // equal to zero but `Object.is` — and therefore `toBe`, `Map` keys, and `includes` — treats it
  // as a distinct value, so a balance of -0 would compare unequal to a balance of 0. It arises
  // routinely: `negate(zero)` and `multiply(anythingNegative, 0)` both produce it.
  return Object.freeze({ minorUnits: minorUnits + 0, currency });
}

/** A zero amount in the given currency. */
export function zero(currency: CurrencyCode): Money {
  return fromMinorUnits(0, currency);
}

/**
 * Parse a decimal string ("1234.56") into Money without ever touching a float.
 *
 * Digits are read as text and padded/validated against the currency scale, so "0.1 + 0.2"
 * problems cannot occur. Rejects excess precision rather than silently rounding — a user typing
 * more decimals than the currency supports is an input error, not a rounding opportunity.
 */
export function fromDecimalString(value: string, currency: CurrencyCode): Money {
  const match = DECIMAL_PATTERN.exec(value.trim());
  if (!match) {
    throw new InvalidAmountError(value, 'expected a decimal number');
  }

  const [, sign, whole = '0', fraction = ''] = match;
  const scale = getScale(currency);

  if (fraction.length > scale) {
    throw new InvalidAmountError(value, `${currency} supports at most ${scale} decimal places`);
  }

  const paddedFraction = fraction.padEnd(scale, '0');
  const digits = `${whole}${paddedFraction}`;
  const magnitude = Number(digits);

  if (!Number.isSafeInteger(magnitude)) {
    throw new AmountOverflowError(magnitude);
  }

  return fromMinorUnits(sign === '-' ? -magnitude : magnitude, currency);
}

/**
 * Convert a decimal *number* to Money. Only safe for values that originate from a UI numeric
 * input; anything crossing a wire should use {@link fromDecimalString}.
 */
export function fromDecimalNumber(value: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(value)) {
    throw new InvalidAmountError(value, 'expected a finite number');
  }
  const factor = getMinorUnitFactor(currency);
  const scaled = Math.round(value * factor);
  // Guard against precision loss having changed the value beyond a half-unit.
  if (Math.abs(value * factor - scaled) > 0.5) {
    throw new InvalidAmountError(value, 'value cannot be represented exactly in minor units');
  }
  return fromMinorUnits(scaled, currency);
}

/** Render as a plain decimal string with the currency's full scale. No grouping, no symbol. */
export function toDecimalString(money: Money): string {
  const scale = getScale(money.currency);
  const negative = money.minorUnits < 0;
  const digits = Math.abs(money.minorUnits).toString().padStart(scale + 1, '0');
  const whole = digits.slice(0, digits.length - scale) || '0';
  const fraction = scale > 0 ? `.${digits.slice(digits.length - scale)}` : '';
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/** Approximate float value. For display maths and charts only — never for a balance. */
export function toDecimalNumber(money: Money): number {
  return money.minorUnits / getMinorUnitFactor(money.currency);
}

export function isMoney(value: unknown): value is Money {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<Money>;
  return Number.isInteger(candidate.minorUnits) && isCurrencyCode(candidate.currency);
}
