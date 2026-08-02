import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  add,
  allocate,
  allocateEvenly,
  applySpread,
  compare,
  convert,
  CurrencyMismatchError,
  format,
  formatParts,
  fromDecimalString,
  fromMinorUnits,
  InvalidAmountError,
  multiply,
  percentage,
  roundMinorUnits,
  subtract,
  sum,
  toDecimalString,
  zero,
} from '../index.js';

const usd = (minorUnits: number) => fromMinorUnits(minorUnits, 'USD');

describe('parsing and rendering', () => {
  it('round-trips decimal strings for scale-2 currencies', () => {
    expect(toDecimalString(fromDecimalString('1234.56', 'USD'))).toBe('1234.56');
    expect(fromDecimalString('1234.56', 'USD').minorUnits).toBe(123_456);
  });

  it('handles a scale-0 currency', () => {
    const yen = fromDecimalString('1500', 'JPY');
    expect(yen.minorUnits).toBe(1500);
    expect(toDecimalString(yen)).toBe('1500');
  });

  it('handles a scale-3 currency', () => {
    const dinar = fromDecimalString('12.345', 'KWD');
    expect(dinar.minorUnits).toBe(12_345);
    expect(toDecimalString(dinar)).toBe('12.345');
  });

  it('pads short fractions', () => {
    expect(fromDecimalString('9.5', 'USD').minorUnits).toBe(950);
  });

  it('rejects excess precision instead of silently rounding', () => {
    expect(() => fromDecimalString('1.005', 'USD')).toThrow(InvalidAmountError);
    expect(() => fromDecimalString('100.5', 'JPY')).toThrow(InvalidAmountError);
  });

  it('rejects non-numeric input', () => {
    expect(() => fromDecimalString('1,234.00', 'USD')).toThrow(InvalidAmountError);
    expect(() => fromDecimalString('abc', 'USD')).toThrow(InvalidAmountError);
  });

  it('renders negatives with the sign outside the padding', () => {
    expect(toDecimalString(usd(-5))).toBe('-0.05');
  });

  it('avoids the float error that plain arithmetic would introduce', () => {
    const tenth = fromDecimalString('0.10', 'USD');
    const fifth = fromDecimalString('0.20', 'USD');
    // Naive `0.1 + 0.2` yields 0.30000000000000004; minor-unit integers cannot drift.
    expect(add(tenth, fifth).minorUnits).toBe(30);
    expect(toDecimalString(add(tenth, fifth))).toBe('0.30');
  });
});

describe('arithmetic', () => {
  it('refuses to mix currencies', () => {
    expect(() => add(usd(100), fromMinorUnits(100, 'EUR'))).toThrow(CurrencyMismatchError);
  });

  it('subtracts and compares', () => {
    expect(subtract(usd(500), usd(200)).minorUnits).toBe(300);
    expect(compare(usd(1), usd(2))).toBe(-1);
    expect(compare(usd(2), usd(2))).toBe(0);
    expect(compare(usd(3), usd(2))).toBe(1);
  });

  it('sums an empty list to zero', () => {
    expect(sum([], 'USD')).toEqual(zero('USD'));
  });

  it('takes a percentage', () => {
    expect(percentage(usd(10_000), 2.5).minorUnits).toBe(250);
  });

  it('rounds half-even to avoid upward bias', () => {
    expect(roundMinorUnits(0.5)).toBe(0);
    expect(roundMinorUnits(1.5)).toBe(2);
    expect(roundMinorUnits(2.5)).toBe(2);
    expect(roundMinorUnits(3.5)).toBe(4);
    expect(roundMinorUnits(-0.5)).toBe(0);
    expect(roundMinorUnits(-1.5)).toBe(-2);
    expect(roundMinorUnits(-2.5)).toBe(-2);
  });

  it('supports explicit rounding modes', () => {
    expect(multiply(usd(101), 0.5, 'down').minorUnits).toBe(50);
    expect(multiply(usd(101), 0.5, 'up').minorUnits).toBe(51);
    expect(multiply(usd(101), 0.5, 'half-up').minorUnits).toBe(51);
  });
});

describe('allocate', () => {
  it('distributes the classic indivisible cent', () => {
    const parts = allocate(usd(100), [1, 1, 1]);
    expect(parts.map((part) => part.minorUnits)).toEqual([34, 33, 33]);
  });

  it('respects weighting', () => {
    const parts = allocate(usd(1000), [3, 1]);
    expect(parts.map((part) => part.minorUnits)).toEqual([750, 250]);
  });

  it('preserves sign for a negative total', () => {
    const parts = allocate(usd(-100), [1, 1, 1]);
    expect(parts.map((part) => part.minorUnits)).toEqual([-34, -33, -33]);
  });

  it('rejects a degenerate ratio set', () => {
    expect(() => allocate(usd(100), [])).toThrow(RangeError);
    expect(() => allocate(usd(100), [0, 0])).toThrow(RangeError);
    expect(() => allocate(usd(100), [-1, 2])).toThrow(RangeError);
  });

  it('never loses or invents a minor unit, for any total and any split', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 12 }),
        (minorUnits, ratios) => {
          const parts = allocate(usd(minorUnits), ratios);
          const total = parts.reduce((acc, part) => acc + part.minorUnits, 0);
          expect(total).toBe(minorUnits);
          expect(parts).toHaveLength(ratios.length);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('allocateEvenly matches an equal-ratio allocate', () => {
    expect(allocateEvenly(usd(1000), 7)).toEqual(allocate(usd(1000), [1, 1, 1, 1, 1, 1, 1]));
    expect(() => allocateEvenly(usd(100), 0)).toThrow(RangeError);
  });
});

describe('convert', () => {
  it('is a no-op for the same currency', () => {
    const result = convert({ amount: usd(1234), to: 'USD', rate: 1.5 });
    expect(result.converted).toEqual(usd(1234));
    expect(result.roundingDelta).toBe(0);
  });

  it('crosses a scale boundary correctly (USD scale 2 → JPY scale 0)', () => {
    const result = convert({ amount: usd(10_000), to: 'JPY', rate: 150 });
    expect(result.converted.minorUnits).toBe(15_000);
    expect(result.converted.currency).toBe('JPY');
  });

  it('reports the rounding delta so it can be posted to account 9000', () => {
    const result = convert({ amount: usd(333), to: 'EUR', rate: 0.9137 });
    const exact = (333 / 100) * 0.9137 * 100;
    expect(result.roundingDelta).toBeCloseTo(result.converted.minorUnits - exact, 10);
    expect(Math.abs(result.roundingDelta)).toBeLessThanOrEqual(0.5);
  });

  it('rejects a non-positive rate', () => {
    expect(() => convert({ amount: usd(100), to: 'EUR', rate: 0 })).toThrow(RangeError);
  });

  it('moves the spread against the customer on both sides', () => {
    expect(applySpread(1.1, 50, 'customer-buys')).toBeLessThan(1.1);
    expect(applySpread(1.1, 50, 'customer-sells')).toBeGreaterThan(1.1);
    expect(() => applySpread(1.1, -1, 'customer-buys')).toThrow(RangeError);
  });
});

describe('format', () => {
  it('renders with a symbol by default', () => {
    expect(format(usd(123_456))).toBe('$1,234.56');
  });

  it('renders with a code', () => {
    expect(format(usd(123_456), { display: 'code' })).toBe('USD 1,234.56');
  });

  it('forces a sign for credit rows', () => {
    expect(format(usd(500), { signDisplay: 'always' })).toContain('+');
  });

  it('respects a scale-0 currency', () => {
    expect(format(fromMinorUnits(1500, 'JPY'))).toBe('¥1,500');
  });

  it('splits into styleable parts', () => {
    const parts = formatParts(usd(-123_456));
    expect(parts).toMatchObject({ sign: '-', integer: '1,234', fraction: '56', currency: 'USD' });
  });

  it('marks a positive amount when asked', () => {
    expect(formatParts(usd(100), { signDisplay: 'always' }).sign).toBe('+');
    expect(formatParts(usd(-100), { signDisplay: 'never' }).sign).toBe('');
  });
});
