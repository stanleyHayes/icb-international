import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { LimitExceededError } from '../../../../common/errors/index.js';
import { feesFor, totalFees } from '../transfer-fees.js';
import { assertDailyLimit, assertPerTransactionLimit } from '../transfer-limits.js';

describe('feesFor', () => {
  it('is free for book transfers and ACH', () => {
    expect(feesFor('internal', 'GBP')).toEqual([]);
    expect(feesFor('on_us', 'GBP')).toEqual([]);
    expect(feesFor('ach', 'GBP')).toEqual([]);
  });

  it('charges a flat fee in the debit currency for wire and SWIFT', () => {
    const [wire] = feesFor('wire', 'GBP');
    expect(wire?.code).toBe('WIRE_FEE');
    expect(wire?.amount).toEqual({ minorUnits: 2500, currency: 'GBP' });

    const [swift] = feesFor('swift', 'EUR');
    expect(swift?.amount).toEqual({ minorUnits: 3500, currency: 'EUR' });
  });

  it('sums a breakdown, returning zero for a free rail', () => {
    expect(totalFees(feesFor('wire', 'GBP'), 'GBP').minorUnits).toBe(2500);
    expect(totalFees([], 'GBP').minorUnits).toBe(0);
  });
});

describe('assertPerTransactionLimit', () => {
  it('passes under the rail cap', () => {
    expect(() =>
      assertPerTransactionLimit('ach', fromMinorUnits(4_000_000, 'GBP')),
    ).not.toThrow();
  });

  it('throws a typed error over the rail cap, naming the limit', () => {
    expect(() =>
      assertPerTransactionLimit('ach', fromMinorUnits(5_000_001, 'GBP')),
    ).toThrow(LimitExceededError);
  });
});

describe('assertDailyLimit', () => {
  it('applies the cap to the running daily total, not the single transfer', () => {
    const amount = fromMinorUnits(6_000_000, 'GBP'); // £60k of the £100k ACH daily cap
    expect(() => assertDailyLimit('ach', amount, 3_000_000)).not.toThrow();
    expect(() => assertDailyLimit('ach', amount, 5_000_000)).toThrow(LimitExceededError);
  });
});
