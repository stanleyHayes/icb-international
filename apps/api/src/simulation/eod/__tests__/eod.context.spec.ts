import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { CurrencyTotals, isFirstOfMonth, periodOf, reportingCurrency } from '../eod.context.js';

describe('reportingCurrency', () => {
  it('keeps a recognised currency code', () => {
    expect(reportingCurrency('GBP')).toBe('GBP');
  });

  it('falls back to USD for an unrecognised code', () => {
    expect(reportingCurrency('XXX')).toBe('USD');
    expect(reportingCurrency('')).toBe('USD');
  });
});

describe('CurrencyTotals', () => {
  it('accumulates per currency and breaks the totals down', () => {
    const totals = new CurrencyTotals();

    totals.add(fromMinorUnits(100, 'USD'));
    totals.add(fromMinorUnits(250, 'USD'));
    totals.add(fromMinorUnits(700, 'EUR'));

    expect(totals.breakdown()).toEqual([
      { currency: 'USD', minorUnits: 350 },
      { currency: 'EUR', minorUnits: 700 },
    ]);
  });

  it('folds every currency into one figure at face value', () => {
    const totals = new CurrencyTotals();
    totals.add(fromMinorUnits(350, 'USD'));
    totals.add(fromMinorUnits(700, 'EUR'));

    expect(totals.toMoney('USD')).toEqual(fromMinorUnits(1050, 'USD'));
  });

  it('reports zero when nothing was added', () => {
    const totals = new CurrencyTotals();

    expect(totals.breakdown()).toEqual([]);
    expect(totals.toMoney('GBP')).toEqual(fromMinorUnits(0, 'GBP'));
  });
});

describe('periodOf', () => {
  it('is the YYYY-MM containing the date', () => {
    expect(periodOf('2026-08-04')).toBe('2026-08');
    expect(periodOf('2026-12-31')).toBe('2026-12');
  });
});

describe('isFirstOfMonth', () => {
  it('is true only on the first calendar day', () => {
    expect(isFirstOfMonth('2026-08-01')).toBe(true);
    expect(isFirstOfMonth('2026-08-04')).toBe(false);
    expect(isFirstOfMonth('2026-08-31')).toBe(false);
  });
});
