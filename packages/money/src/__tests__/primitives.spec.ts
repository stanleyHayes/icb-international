import { describe, expect, it } from 'vitest';

import {
  absolute,
  AmountOverflowError,
  CURRENCY_CODES,
  CurrencyMismatchError,
  equals,
  formatCompact,
  fromDecimalNumber,
  fromMinorUnits,
  getCurrency,
  getMinorUnitFactor,
  getScale,
  InvalidAmountError,
  isCurrencyCode,
  isGreaterThan,
  isGreaterThanOrEqual,
  isLessThan,
  isLessThanOrEqual,
  isMoney,
  isNegative,
  isPositive,
  isZero,
  listCurrencies,
  max,
  min,
  MoneyError,
  multiply,
  negate,
  subtract,
  sum,
  toDecimalNumber,
  zero,
} from '../index.js';

const usd = (minorUnits: number) => fromMinorUnits(minorUnits, 'USD');

describe('currency registry', () => {
  it('exposes every declared code', () => {
    expect(listCurrencies()).toHaveLength(CURRENCY_CODES.length);
    expect(getCurrency('GHS').symbol).toBe('GH₵');
    expect(getCurrency('GHS').numericCode).toBe('936');
  });

  it('knows the non-obvious scales', () => {
    expect(getScale('JPY')).toBe(0);
    expect(getScale('KWD')).toBe(3);
    expect(getScale('USD')).toBe(2);
  });

  it('computes the minor unit factor from the scale', () => {
    expect(getMinorUnitFactor('JPY')).toBe(1);
    expect(getMinorUnitFactor('USD')).toBe(100);
    expect(getMinorUnitFactor('KWD')).toBe(1000);
  });

  it('narrows unknown input', () => {
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('XXX')).toBe(false);
    expect(isCurrencyCode(42)).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
  });
});

describe('construction guards', () => {
  it('rejects a non-integer minor unit', () => {
    expect(() => fromMinorUnits(1.5, 'USD')).toThrow(InvalidAmountError);
    expect(() => fromMinorUnits(Number.NaN, 'USD')).toThrow(InvalidAmountError);
    expect(() => fromMinorUnits(Number.POSITIVE_INFINITY, 'USD')).toThrow(InvalidAmountError);
  });

  it('rejects an amount beyond the safe integer range', () => {
    expect(() => fromMinorUnits(Number.MAX_SAFE_INTEGER + 2, 'USD')).toThrow(AmountOverflowError);
  });

  it('returns a frozen value object', () => {
    expect(Object.isFrozen(usd(100))).toBe(true);
  });

  it('builds zero', () => {
    expect(zero('EUR')).toEqual({ minorUnits: 0, currency: 'EUR' });
  });

  it('converts from a decimal number when it is exactly representable', () => {
    expect(fromDecimalNumber(12.34, 'USD').minorUnits).toBe(1234);
    expect(fromDecimalNumber(1500, 'JPY').minorUnits).toBe(1500);
  });

  it('rejects a decimal number that cannot be represented', () => {
    expect(() => fromDecimalNumber(Number.NaN, 'USD')).toThrow(InvalidAmountError);
    expect(() => fromDecimalNumber(Number.POSITIVE_INFINITY, 'USD')).toThrow(InvalidAmountError);
  });

  it('narrows an unknown value to Money', () => {
    expect(isMoney(usd(1))).toBe(true);
    expect(isMoney({ minorUnits: 1, currency: 'XXX' })).toBe(false);
    expect(isMoney({ minorUnits: 1.5, currency: 'USD' })).toBe(false);
    expect(isMoney(null)).toBe(false);
    expect(isMoney('100')).toBe(false);
  });

  it('exposes an approximate float for charting', () => {
    expect(toDecimalNumber(usd(123_456))).toBeCloseTo(1234.56, 6);
  });
});

describe('comparators and sign helpers', () => {
  it('orders amounts', () => {
    expect(isLessThan(usd(1), usd(2))).toBe(true);
    expect(isGreaterThan(usd(3), usd(2))).toBe(true);
    expect(isLessThanOrEqual(usd(2), usd(2))).toBe(true);
    expect(isGreaterThanOrEqual(usd(2), usd(2))).toBe(true);
    expect(equals(usd(2), usd(2))).toBe(true);
  });

  it('reports sign', () => {
    expect(isZero(zero('USD'))).toBe(true);
    expect(isPositive(usd(1))).toBe(true);
    expect(isNegative(usd(-1))).toBe(true);
    expect(isPositive(usd(-1))).toBe(false);
  });

  it('picks extremes', () => {
    expect(min(usd(5), usd(9))).toEqual(usd(5));
    expect(max(usd(5), usd(9))).toEqual(usd(9));
    expect(min(usd(9), usd(5))).toEqual(usd(5));
    expect(max(usd(9), usd(5))).toEqual(usd(9));
  });

  it('negates and absolutises', () => {
    expect(negate(usd(-250))).toEqual(usd(250));
    expect(absolute(usd(-250))).toEqual(usd(250));
    expect(absolute(usd(250))).toEqual(usd(250));
  });

  it('rejects cross-currency comparison', () => {
    expect(() => isLessThan(usd(1), fromMinorUnits(1, 'EUR'))).toThrow(CurrencyMismatchError);
    expect(() => subtract(usd(1), fromMinorUnits(1, 'GBP'))).toThrow(CurrencyMismatchError);
  });

  it('sums a list', () => {
    expect(sum([usd(100), usd(250), usd(-50)], 'USD')).toEqual(usd(300));
  });

  it('rejects a non-finite multiplier', () => {
    expect(() => multiply(usd(100), Number.NaN)).toThrow(TypeError);
  });
});

describe('errors', () => {
  it('all derive from MoneyError with a useful name', () => {
    const mismatch = new CurrencyMismatchError('USD', 'EUR');
    expect(mismatch).toBeInstanceOf(MoneyError);
    expect(mismatch.name).toBe('CurrencyMismatchError');
    expect(mismatch.left).toBe('USD');
    expect(mismatch.right).toBe('EUR');

    const overflow = new AmountOverflowError(1);
    expect(overflow).toBeInstanceOf(MoneyError);
    expect(overflow.value).toBe(1);

    const invalid = new InvalidAmountError('x', 'because');
    expect(invalid.message).toContain('because');
  });
});

describe('compact formatting', () => {
  it('abbreviates large figures for dense dashboards', () => {
    expect(formatCompact(usd(1_234_500))).toBe('$12.3K');
    expect(formatCompact(usd(500_000_000))).toBe('$5M');
  });

  it('strips the trailing zero rather than leaving it to the host ICU', () => {
    // A loose /5M/ passed on macOS and failed on CI, where ICU rendered '$5.0M'. Exact equality
    // is the point: the same figure must format identically on every machine that runs this.
    expect(formatCompact(usd(100_000_000))).toBe('$1M');
    expect(formatCompact(usd(150_000_000))).toBe('$1.5M');
    expect(formatCompact(usd(100_000))).toBe('$1K');
  });

  it('drops a zero fraction when asked', () => {
    expect(formatCompact(usd(100))).toMatch(/\$1/);
  });
});
