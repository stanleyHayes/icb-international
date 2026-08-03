import { describe, expect, it } from 'vitest';

import {
  fxFeeMinorUnits,
  lateFeeMinorUnits,
  overdraftFeeMinorUnits,
  transactionFeeMinorUnits,
} from '../domain/fee-schedule.js';

describe('transactionFeeMinorUnits', () => {
  it('charges nothing within the free allowance', () => {
    expect(transactionFeeMinorUnits(0, 'USD')).toBe(0);
    expect(transactionFeeMinorUnits(10, 'USD')).toBe(0);
  });

  it('charges per item beyond the allowance', () => {
    // 13 debits: 3 excess at 0.50 USD each.
    expect(transactionFeeMinorUnits(13, 'USD')).toBe(150);
  });

  it('converts the flat fee for a zero-decimal currency', () => {
    // 12 debits: 2 excess at 0.5 JPY each, rounded to whole yen.
    expect(transactionFeeMinorUnits(12, 'JPY')).toBe(1);
  });
});

describe('overdraftFeeMinorUnits', () => {
  it('accrues one day of interest on the overdrawn base, ACT/360', () => {
    // 2_000.00 overdrawn at 19.9% for one day: 200_000 × 0.199 / 360 ≈ 110.56 → 111.
    expect(overdraftFeeMinorUnits(200_000, 1)).toBe(111);
  });

  it('scales with the number of days', () => {
    expect(overdraftFeeMinorUnits(200_000, 10)).toBe(1_106);
  });

  it('returns zero when there is nothing overdrawn', () => {
    expect(overdraftFeeMinorUnits(0, 1)).toBe(0);
    expect(overdraftFeeMinorUnits(200_000, 0)).toBe(0);
  });

  it('accepts a rate override', () => {
    // 360_000 at 10% for one day: exactly 100.
    expect(overdraftFeeMinorUnits(360_000, 1, 0.1)).toBe(100);
  });
});

describe('fxFeeMinorUnits', () => {
  it('is a percentage of the conversion volume', () => {
    // 0.5% of 10_000.00 = 50.00.
    expect(fxFeeMinorUnits(1_000_000)).toBe(5_000);
  });

  it('rounds half-even and floors at zero', () => {
    expect(fxFeeMinorUnits(0)).toBe(0);
    expect(fxFeeMinorUnits(-5)).toBe(0);
  });
});

describe('lateFeeMinorUnits', () => {
  it('is a flat fee per overdue instalment', () => {
    // 2 overdue instalments at 25.00 USD each.
    expect(lateFeeMinorUnits(2, 'USD')).toBe(5_000);
  });

  it('returns zero when nothing is overdue', () => {
    expect(lateFeeMinorUnits(0, 'USD')).toBe(0);
  });
});
