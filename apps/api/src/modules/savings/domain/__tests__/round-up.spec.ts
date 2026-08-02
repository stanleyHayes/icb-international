import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { roundedTotalMinorUnits, roundUpFor, roundUpMinorUnits } from '../round-up.js';

describe('round-up maths', () => {
  it('sweeps the change up to the next whole major unit', () => {
    expect(roundUpMinorUnits(430, 2)).toBe(70);
    expect(roundUpMinorUnits(1, 2)).toBe(99);
    expect(roundUpMinorUnits(1_234_567, 2)).toBe(33);
  });

  it('sweeps nothing when the purchase is already whole', () => {
    expect(roundUpMinorUnits(500, 2)).toBe(0);
    expect(roundUpMinorUnits(10_000, 2)).toBe(0);
  });

  it('sweeps nothing for a refund or a zero-value purchase', () => {
    expect(roundUpMinorUnits(0, 2)).toBe(0);
    expect(roundUpMinorUnits(-430, 2)).toBe(0);
  });

  it('sweeps nothing on a zero-decimal currency rounded to the nearest unit', () => {
    expect(roundUpMinorUnits(1_499, 0)).toBe(0);
  });

  it('honours a coarser multiple, including on a zero-decimal currency', () => {
    expect(roundUpMinorUnits(430, 2, 5)).toBe(70);
    expect(roundUpMinorUnits(1_230, 2, 5)).toBe(270);
    expect(roundUpMinorUnits(1_499, 0, 100)).toBe(1);
    expect(roundUpMinorUnits(430, 2, 0)).toBe(70);
  });

  it('always lands the total on the boundary it rounded to', () => {
    for (const purchase of [1, 99, 430, 1_000, 2_501, 99_999]) {
      expect(roundedTotalMinorUnits(purchase, 2) % 100).toBe(0);
    }
  });

  it('returns money in the purchase currency without the caller knowing its scale', () => {
    expect(roundUpFor(fromMinorUnits(430, 'GBP'))).toStrictEqual(fromMinorUnits(70, 'GBP'));
    expect(roundUpFor(fromMinorUnits(1_499, 'JPY'))).toStrictEqual(fromMinorUnits(0, 'JPY'));
  });
});
