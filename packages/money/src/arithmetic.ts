import type { CurrencyCode } from './currency.js';
import { CurrencyMismatchError } from './errors.js';
import { fromMinorUnits, zero, type Money } from './money.js';

/** Rounding modes available to operations that can produce a fractional minor unit. */
export const ROUNDING_MODES = ['half-even', 'half-up', 'down', 'up'] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new CurrencyMismatchError(left.currency, right.currency);
  }
}

/**
 * Round a fractional minor-unit value to an integer.
 *
 * `half-even` (banker's rounding) is the default across ICB because it does not bias totals
 * upward over many operations — material once interest accrues daily across thousands of
 * accounts.
 */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const remainder = value - floor;
  if (remainder > 0.5) return floor + 1;
  if (remainder < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

function roundAwayFromZero(value: number): number {
  return value < 0 ? Math.floor(value) : Math.ceil(value);
}

export function roundMinorUnits(value: number, mode: RoundingMode = 'half-even'): number {
  switch (mode) {
    case 'down':
      return Math.trunc(value);
    case 'up':
      return roundAwayFromZero(value);
    case 'half-up':
      return roundHalfUp(value);
    case 'half-even':
      return roundHalfEven(value);
  }
}

export function add(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return fromMinorUnits(left.minorUnits + right.minorUnits, left.currency);
}

export function subtract(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return fromMinorUnits(left.minorUnits - right.minorUnits, left.currency);
}

export function negate(money: Money): Money {
  return fromMinorUnits(-money.minorUnits, money.currency);
}

export function absolute(money: Money): Money {
  return fromMinorUnits(Math.abs(money.minorUnits), money.currency);
}

/** Multiply by a scalar (e.g. a quantity or an interest factor), rounding to a whole minor unit. */
export function multiply(money: Money, factor: number, mode: RoundingMode = 'half-even'): Money {
  if (!Number.isFinite(factor)) {
    throw new TypeError(`Cannot multiply money by ${factor}`);
  }
  return fromMinorUnits(roundMinorUnits(money.minorUnits * factor, mode), money.currency);
}

/** Take a percentage, e.g. `percentage(m, 1.5)` for 1.5%. */
export function percentage(money: Money, percent: number, mode: RoundingMode = 'half-even'): Money {
  return multiply(money, percent / 100, mode);
}

export function sum(amounts: readonly Money[], currency: CurrencyCode): Money {
  return amounts.reduce<Money>((total, amount) => add(total, amount), zero(currency));
}

/** -1 if left < right, 0 if equal, 1 if left > right. */
export function compare(left: Money, right: Money): -1 | 0 | 1 {
  assertSameCurrency(left, right);
  if (left.minorUnits < right.minorUnits) return -1;
  if (left.minorUnits > right.minorUnits) return 1;
  return 0;
}

export const equals = (left: Money, right: Money): boolean => compare(left, right) === 0;
export const isGreaterThan = (left: Money, right: Money): boolean => compare(left, right) === 1;
export const isLessThan = (left: Money, right: Money): boolean => compare(left, right) === -1;

export const isGreaterThanOrEqual = (left: Money, right: Money): boolean =>
  compare(left, right) >= 0;

export const isLessThanOrEqual = (left: Money, right: Money): boolean => compare(left, right) <= 0;

export const isZero = (money: Money): boolean => money.minorUnits === 0;
export const isPositive = (money: Money): boolean => money.minorUnits > 0;
export const isNegative = (money: Money): boolean => money.minorUnits < 0;

export function min(left: Money, right: Money): Money {
  return isLessThanOrEqual(left, right) ? left : right;
}

export function max(left: Money, right: Money): Money {
  return isGreaterThanOrEqual(left, right) ? left : right;
}
