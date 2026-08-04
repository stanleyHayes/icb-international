import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  add,
  AmountOverflowError,
  compare,
  CURRENCY_CODES,
  CurrencyMismatchError,
  fromDecimalString,
  fromMinorUnits,
  multiply,
  negate,
  subtract,
  sum,
  toDecimalString,
  zero,
} from '../index.js';

/**
 * Property tests for money arithmetic — the algebra every ledger posting relies on.
 *
 * `money.spec.ts` already covers allocation re-summing and the fixed examples; this file covers
 * the rest of the arithmetic surface and deliberately duplicates none of it. The §10 gate is
 * 10k cases, which pure integer arithmetic runs in well under a second.
 */
const RUNS = { numRuns: 10_000 };

/** Head-room below MAX_SAFE_INTEGER so a generated triple can never overflow a *valid* add. */
const BOUND = Math.floor(Number.MAX_SAFE_INTEGER / 8);

const arbCurrency = fc.constantFrom(...CURRENCY_CODES);
const arbMinorUnits = fc.integer({ min: -BOUND, max: BOUND });
const arbMoney = fc
  .tuple(arbMinorUnits, arbCurrency)
  .map(([minorUnits, currency]) => fromMinorUnits(minorUnits, currency));

/** Three amounts in one currency, for the associativity property. */
const arbTriple = fc
  .tuple(arbCurrency, arbMinorUnits, arbMinorUnits, arbMinorUnits)
  .map(([currency, a, b, c]) =>
    [fromMinorUnits(a, currency), fromMinorUnits(b, currency), fromMinorUnits(c, currency)] as const,
  );

describe('money arithmetic properties', () => {
  it('addition is commutative, associative, and has zero as identity', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(arbTriple, ([a, b, c]) => {
        expect(add(a, b)).toEqual(add(b, a));
        expect(add(add(a, b), c)).toEqual(add(a, add(b, c)));
        expect(add(a, zero(a.currency))).toEqual(a);
      }),
      RUNS,
    );
  });

  it('every amount has an exact additive inverse', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(arbMoney, (a) => {
        expect(negate(negate(a))).toEqual(a);
        expect(add(a, negate(a))).toEqual(zero(a.currency));
        expect(subtract(a, a)).toEqual(zero(a.currency));
      }),
      RUNS,
    );
  });

  it('subtraction is addition of the negation', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        arbTriple.map(([a, b]) => [a, b] as const),
        ([a, b]) => {
          expect(subtract(a, b)).toEqual(add(a, negate(b)));
        },
      ),
      RUNS,
    );
  });

  it('comparison agrees with the sign of the subtraction', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        arbTriple.map(([a, b]) => [a, b] as const),
        ([a, b]) => {
          expect(compare(a, b)).toBe(Math.sign(a.minorUnits - b.minorUnits));
        },
      ),
      RUNS,
    );
  });

  it('sum matches a plain integer fold, for any list length', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        arbCurrency,
        fc.array(fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }), {
          maxLength: 50,
        }),
        (currency, amounts) => {
          const total = sum(amounts.map((n) => fromMinorUnits(n, currency)), currency);
          expect(total.minorUnits).toBe(amounts.reduce((acc, n) => acc + n, 0));
          expect(total.currency).toBe(currency);
        },
      ),
      RUNS,
    );
  });

  it('integer multiplication is exact and has 1 as identity, 0 as annihilator', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        arbCurrency,
        fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }),
        fc.integer({ min: -1_000, max: 1_000 }),
        (currency, minorUnits, factor) => {
          const money = fromMinorUnits(minorUnits, currency);
          expect(multiply(money, 1)).toEqual(money);
          expect(multiply(money, 0).minorUnits).toBe(0);
          // `+ 0` on the expected side too: raw JS gives -0 for a negative times zero, and Money
          // deliberately normalises that away, so the two must be compared on the same footing.
          expect(multiply(money, factor).minorUnits).toBe(minorUnits * factor + 0);
        },
      ),
      RUNS,
    );
  });

  it('mixing currencies always throws, never silently converts', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        arbCurrency,
        arbCurrency,
        arbMinorUnits,
        arbMinorUnits,
        (left, right, a, b) => {
          fc.pre(left !== right);
          const leftMoney = fromMinorUnits(a, left);
          const rightMoney = fromMinorUnits(b, right);
          expect(() => add(leftMoney, rightMoney)).toThrow(CurrencyMismatchError);
          expect(() => subtract(leftMoney, rightMoney)).toThrow(CurrencyMismatchError);
          expect(() => compare(leftMoney, rightMoney)).toThrow(CurrencyMismatchError);
        },
      ),
      RUNS,
    );
  });

  it('overflow throws instead of wrapping past the safe-integer range', { timeout: 60_000 }, () => {
    const big = fc.integer({ min: 2 ** 52, max: Number.MAX_SAFE_INTEGER });
    fc.assert(
      fc.property(arbCurrency, big, big, (currency, a, b) => {
        expect(() => add(fromMinorUnits(a, currency), fromMinorUnits(b, currency))).toThrow(
          AmountOverflowError,
        );
        expect(() =>
          add(fromMinorUnits(-a, currency), fromMinorUnits(-b, currency)),
        ).toThrow(AmountOverflowError);
      }),
      RUNS,
    );
  });

  it('decimal strings round-trip exactly, in every currency and sign', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(arbMoney, (money) => {
        expect(fromDecimalString(toDecimalString(money), money.currency)).toEqual(money);
      }),
      RUNS,
    );
  });
});
