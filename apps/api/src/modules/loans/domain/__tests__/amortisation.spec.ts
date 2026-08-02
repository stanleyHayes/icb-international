import type { RepaymentFrequency } from '@icb/contracts';
import { add, fromMinorUnits, sum, zero, type CurrencyCode } from '@icb/money';
import { describe, expect, it } from 'vitest';

import {
  annuityFactor,
  buildSchedule,
  instalmentCount,
  levelInstalment,
  periodicRate,
  type AmortisationInput,
} from '../amortisation.js';

const USD: CurrencyCode = 'USD';

/**
 * Deliberately awkward cases: principals that do not divide evenly, rates that do not produce
 * clean periodic factors, and terms that are prime. If a cent can be lost, it is lost here.
 */
const CASES: readonly { label: string; input: AmortisationInput }[] = [
  {
    label: '10,000.00 at 7.9% over 24 monthly instalments',
    input: {
      principal: fromMinorUnits(1_000_000, USD),
      annualRatePercent: 7.9,
      termMonths: 24,
      frequency: 'monthly',
    },
  },
  {
    label: '3,333.33 at 19.9% over 13 monthly instalments',
    input: {
      principal: fromMinorUnits(333_333, USD),
      annualRatePercent: 19.9,
      termMonths: 13,
      frequency: 'monthly',
    },
  },
  {
    label: '1.00 at 21.75% over 7 monthly instalments',
    input: {
      principal: fromMinorUnits(100, USD),
      annualRatePercent: 21.75,
      termMonths: 7,
      frequency: 'monthly',
    },
  },
  {
    label: '250,000.00 interest free over 60 monthly instalments',
    input: {
      principal: fromMinorUnits(25_000_000, USD),
      annualRatePercent: 0,
      termMonths: 60,
      frequency: 'monthly',
    },
  },
  {
    label: '17,777.77 at 11.3% weekly over 18 months',
    input: {
      principal: fromMinorUnits(1_777_777, USD),
      annualRatePercent: 11.3,
      termMonths: 18,
      frequency: 'weekly',
    },
  },
  {
    label: '99,999.99 at 6.45% fortnightly over 37 months',
    input: {
      principal: fromMinorUnits(9_999_999, USD),
      annualRatePercent: 6.45,
      termMonths: 37,
      frequency: 'fortnightly',
    },
  },
  {
    label: '500,000.01 at 17.5% quarterly over 120 months',
    input: {
      principal: fromMinorUnits(50_000_001, USD),
      annualRatePercent: 17.5,
      termMonths: 120,
      frequency: 'quarterly',
    },
  },
];

describe('buildSchedule', () => {
  for (const { label, input } of CASES) {
    describe(label, () => {
      const schedule = buildSchedule(input);

      it('repays exactly the principal — no cent invented, none lost', () => {
        const principalTotal = sum(
          schedule.rows.map((row) => row.principal),
          input.principal.currency,
        );
        expect(principalTotal.minorUnits).toBe(input.principal.minorUnits);
      });

      it('closes at exactly zero', () => {
        const final = schedule.rows.at(-1);
        expect(final).toBeDefined();
        expect(final?.closingBalance).toEqual(zero(input.principal.currency));
      });

      it('re-sums interest and principal to the instalment on every row', () => {
        for (const row of schedule.rows) {
          expect(add(row.principal, row.interest).minorUnits).toBe(row.instalment.minorUnits);
        }
      });

      it('carries the closing balance into the next opening balance', () => {
        expect(schedule.rows[0]?.openingBalance.minorUnits).toBe(input.principal.minorUnits);
        schedule.rows.forEach((row, index) => {
          const next = schedule.rows[index + 1];
          if (next) {
            expect(next.openingBalance.minorUnits).toBe(row.closingBalance.minorUnits);
          }
        });
      });

      it('produces one row per instalment and never a negative balance', () => {
        expect(schedule.rows).toHaveLength(instalmentCount(input.termMonths, input.frequency));
        for (const row of schedule.rows) {
          expect(row.closingBalance.minorUnits).toBeGreaterThanOrEqual(0);
          expect(row.principal.minorUnits).toBeGreaterThanOrEqual(0);
          expect(row.interest.minorUnits).toBeGreaterThanOrEqual(0);
        }
      });

      it('totals repayable as principal plus interest', () => {
        expect(schedule.totalRepayable.minorUnits).toBe(
          input.principal.minorUnits + schedule.totalInterest.minorUnits,
        );
      });
    });
  }
});

describe('levelInstalment', () => {
  it('matches the textbook annuity for 10,000 at 6% over 12 monthly instalments', () => {
    // A = 10000 × 0.005 / (1 − 1.005^−12) = 860.664…
    const instalment = levelInstalment({
      principal: fromMinorUnits(1_000_000, USD),
      annualRatePercent: 6,
      termMonths: 12,
      frequency: 'monthly',
    });
    expect(instalment.minorUnits).toBe(86_066);
  });

  it('degenerates to principal ÷ count at a zero rate', () => {
    const instalment = levelInstalment({
      principal: fromMinorUnits(1_200_000, USD),
      annualRatePercent: 0,
      termMonths: 24,
      frequency: 'monthly',
    });
    expect(instalment.minorUnits).toBe(50_000);
  });

  it('rejects a non-positive principal', () => {
    expect(() =>
      levelInstalment({
        principal: zero(USD),
        annualRatePercent: 5,
        termMonths: 12,
        frequency: 'monthly',
      }),
    ).toThrow(/greater than zero/);
  });

  it('rejects a negative rate and a non-integer term', () => {
    const base: AmortisationInput = {
      principal: fromMinorUnits(100_000, USD),
      annualRatePercent: 5,
      termMonths: 12,
      frequency: 'monthly',
    };
    expect(() => levelInstalment({ ...base, annualRatePercent: -1 })).toThrow(/non-negative/);
    expect(() => levelInstalment({ ...base, termMonths: 0 })).toThrow(/positive whole number/);
  });
});

describe('period conversions', () => {
  const expectations: readonly [RepaymentFrequency, number, number][] = [
    ['monthly', 24, 24],
    ['weekly', 12, 52],
    ['fortnightly', 12, 26],
    ['quarterly', 24, 8],
  ];

  it('converts a term in months into an instalment count', () => {
    for (const [frequency, termMonths, expected] of expectations) {
      expect(instalmentCount(termMonths, frequency)).toBe(expected);
    }
  });

  it('never produces fewer than one instalment', () => {
    expect(instalmentCount(1, 'quarterly')).toBe(1);
  });

  it('divides the annual rate across the periods in a year', () => {
    expect(periodicRate(12, 'monthly')).toBeCloseTo(0.01, 12);
    expect(periodicRate(13, 'quarterly')).toBeCloseTo(0.0325, 12);
  });

  it('reduces the annuity factor to the instalment count at a zero rate', () => {
    expect(annuityFactor(0, 36)).toBe(36);
    expect(annuityFactor(0.01, 12)).toBeCloseTo(11.255077, 5);
  });
});
