import type { RepaymentFrequency } from '@icb/contracts';
import { add, allocate, multiply, subtract, sum, zero, type Money } from '@icb/money';

import { ValidationError } from '../../../common/errors/index.js';

/**
 * Amortisation.
 *
 * Pure functions over `Money`. No clock, no database, no framework — which is what makes the
 * arithmetic testable in isolation and reusable by the quote endpoint, the offer, and servicing
 * without three subtly different implementations of the same annuity.
 *
 * Two invariants hold for every schedule this file produces, and both are asserted in
 * `__tests__/amortisation.spec.ts`:
 *
 *  1. the principal components sum *exactly* to the loan principal;
 *  2. the final closing balance is *exactly* zero.
 *
 * They hold because the principal column is apportioned with `allocate()` rather than rounded
 * period by period. Rounding each period independently is how a loan ends up owing three cents
 * after its final payment.
 */

const PERIODS_PER_YEAR: Readonly<Record<RepaymentFrequency, number>> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
};

const MONTHS_PER_YEAR = 12;
const PERCENT = 100;

export interface AmortisationInput {
  readonly principal: Money;
  /** Annual nominal rate as a percentage, e.g. `12.5` for 12.5% p.a. */
  readonly annualRatePercent: number;
  readonly termMonths: number;
  readonly frequency: RepaymentFrequency;
}

/** One period of a reducing-balance schedule. `principal + interest === instalment`, always. */
export interface AmortisationRow {
  readonly number: number;
  readonly openingBalance: Money;
  readonly instalment: Money;
  readonly principal: Money;
  readonly interest: Money;
  readonly closingBalance: Money;
}

export interface AmortisationSchedule {
  readonly rows: readonly AmortisationRow[];
  /** The headline level instalment from the annuity formula, rounded to a whole minor unit. */
  readonly instalment: Money;
  readonly totalInterest: Money;
  readonly totalRepayable: Money;
}

export function periodsPerYear(frequency: RepaymentFrequency): number {
  return PERIODS_PER_YEAR[frequency];
}

/** How many instalments a term of `termMonths` produces at the given repayment frequency. */
export function instalmentCount(termMonths: number, frequency: RepaymentFrequency): number {
  return Math.max(1, Math.round((termMonths * periodsPerYear(frequency)) / MONTHS_PER_YEAR));
}

export function periodicRate(annualRatePercent: number, frequency: RepaymentFrequency): number {
  return annualRatePercent / PERCENT / periodsPerYear(frequency);
}

/**
 * Present-value annuity factor — the multiple of one instalment that today's principal equals.
 * At a zero rate it degenerates to the instalment count, which is exactly right.
 */
export function annuityFactor(rate: number, count: number): number {
  return rate === 0 ? count : (1 - (1 + rate) ** -count) / rate;
}

/** The standard annuity instalment: `A = P · i / (1 − (1 + i)^−n)`. */
export function levelInstalment(input: AmortisationInput): Money {
  assertAmortisable(input);
  const count = instalmentCount(input.termMonths, input.frequency);
  const rate = periodicRate(input.annualRatePercent, input.frequency);
  return multiply(input.principal, 1 / annuityFactor(rate, count));
}

/**
 * The share of principal repaid in each period, as ratios rather than amounts.
 *
 * Under a level instalment the principal component of period *k* is `A · (1 + i)^−(n − k + 1)`,
 * so the components stand in the ratio `(1 + i)^k`. Handing those ratios to `allocate()` lets
 * largest-remainder apportionment place every leftover minor unit, so the column sums to the
 * principal by construction instead of by luck. Exponents are normalised to end at 1 so the
 * ratios stay small for long weekly terms.
 */
function principalRatios(rate: number, count: number): number[] {
  const growth = 1 + rate;
  return Array.from({ length: count }, (_, index) => growth ** (index + 1 - count));
}

/**
 * Build the full reducing-balance schedule.
 *
 * Interest is charged on the opening balance of each period; principal is the pre-apportioned
 * share; the instalment is their sum, so a row can never disagree with itself.
 */
export function buildSchedule(input: AmortisationInput): AmortisationSchedule {
  assertAmortisable(input);
  const currency = input.principal.currency;
  const count = instalmentCount(input.termMonths, input.frequency);
  const rate = periodicRate(input.annualRatePercent, input.frequency);
  const principalParts = allocate(input.principal, principalRatios(rate, count));

  const rows: AmortisationRow[] = [];
  let openingBalance = input.principal;

  for (let index = 0; index < count; index += 1) {
    const principal = principalParts[index] ?? zero(currency);
    const interest = multiply(openingBalance, rate);
    const closingBalance = subtract(openingBalance, principal);
    rows.push({
      number: index + 1,
      openingBalance,
      instalment: add(principal, interest),
      principal,
      interest,
      closingBalance,
    });
    openingBalance = closingBalance;
  }

  return summarise(input, rows);
}

function summarise(input: AmortisationInput, rows: AmortisationRow[]): AmortisationSchedule {
  const currency = input.principal.currency;
  const totalInterest = sum(
    rows.map((row) => row.interest),
    currency,
  );
  return {
    rows,
    instalment: levelInstalment(input),
    totalInterest,
    totalRepayable: add(input.principal, totalInterest),
  };
}

function assertAmortisable(input: AmortisationInput): void {
  if (input.principal.minorUnits <= 0) {
    throw new ValidationError('A loan principal must be greater than zero');
  }
  if (!Number.isFinite(input.annualRatePercent) || input.annualRatePercent < 0) {
    throw new ValidationError('A loan rate must be a non-negative number');
  }
  if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) {
    throw new ValidationError('A loan term must be a positive whole number of months');
  }
}
