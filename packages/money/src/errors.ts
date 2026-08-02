import type { CurrencyCode } from './currency.js';

/** Base class for every failure originating in money arithmetic. */
export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Thrown when two amounts in different currencies are combined. There is no implicit FX in this
 * codebase — a conversion must be explicit and must post a rounding delta.
 */
export class CurrencyMismatchError extends MoneyError {
  constructor(
    readonly left: CurrencyCode,
    readonly right: CurrencyCode,
  ) {
    super(`Cannot operate on ${left} and ${right} without an explicit conversion`);
  }
}

/** Thrown when a value cannot be represented exactly as integer minor units. */
export class InvalidAmountError extends MoneyError {
  constructor(
    readonly value: unknown,
    reason: string,
  ) {
    super(`Invalid monetary amount ${String(value)}: ${reason}`);
  }
}

/** Thrown when an operation would exceed the safe-integer range for minor units. */
export class AmountOverflowError extends MoneyError {
  constructor(readonly value: number) {
    super(`Monetary amount ${value} exceeds the safe integer range`);
  }
}
