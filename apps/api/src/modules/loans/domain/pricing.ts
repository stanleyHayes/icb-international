import type { CustomerTier, LoanProduct, RepaymentFrequency } from '@icb/contracts';
import { max, multiply, subtract, zero, type Money } from '@icb/money';

import { annuityFactor, instalmentCount, periodicRate, periodsPerYear } from './amortisation.js';

/**
 * Pricing and affordability.
 *
 * Rates are a function of two things only: the product's published band, and how far through that
 * band the applicant sits. Nothing here reads a clock or a database, so the same inputs always
 * produce the same price — a customer who re-quotes an hour later sees the same number.
 */

const MONTHS_PER_YEAR = 12;
const PERCENT = 100;
const PRICING_FLOOR_SCORE = 400;
const PRICING_SPAN = 600;

/** Share of a total repayment capacity we will commit to a single new loan. */
export const AFFORDABILITY_INSTALMENT_CAP = 0.4;

/** How far down the product's rate band each relationship tier starts, before scoring. */
const TIER_POSITION: Readonly<Record<CustomerTier, number>> = {
  standard: 0.75,
  plus: 0.5,
  premier: 0.25,
  private: 0,
};

function roundRate(rate: number): number {
  return Math.round(rate * PERCENT) / PERCENT;
}

function bandPosition(product: LoanProduct, position: number): number {
  return roundRate(product.fromRate + (product.toRate - product.fromRate) * position);
}

/** The rate shown on an indicative quote, before any underwriting has happened. */
export function indicativeRate(product: LoanProduct, tier: CustomerTier): number {
  return bandPosition(product, TIER_POSITION[tier]);
}

/** The rate offered once scored. A better score earns a rate nearer the headline "from" rate. */
export function scoredRate(product: LoanProduct, score: number): number {
  const quality = Math.min(1, Math.max(0, (score - PRICING_FLOOR_SCORE) / PRICING_SPAN));
  return bandPosition(product, 1 - quality);
}

/** Restate a per-period instalment as its monthly equivalent, for income comparisons. */
export function monthlyEquivalent(instalment: Money, frequency: RepaymentFrequency): Money {
  return multiply(instalment, periodsPerYear(frequency) / MONTHS_PER_YEAR);
}

/** Restate a monthly figure as the equivalent amount per repayment period. */
export function perPeriodFromMonthly(monthly: Money, frequency: RepaymentFrequency): Money {
  return multiply(monthly, MONTHS_PER_YEAR / periodsPerYear(frequency));
}

/** What is left of a capped share of income once existing commitments are met. */
export function maximumMonthlyInstalment(income: Money, commitments: Money): Money {
  const capacity = multiply(income, AFFORDABILITY_INSTALMENT_CAP);
  return max(subtract(capacity, commitments), zero(income.currency));
}

export interface AffordabilityInput {
  readonly maximumMonthlyInstalment: Money;
  readonly annualRatePercent: number;
  readonly termMonths: number;
  readonly frequency: RepaymentFrequency;
}

/** The largest principal an applicant's monthly capacity supports at this term and rate. */
export function affordablePrincipal(input: AffordabilityInput): Money {
  const perPeriod = perPeriodFromMonthly(input.maximumMonthlyInstalment, input.frequency);
  const count = instalmentCount(input.termMonths, input.frequency);
  const rate = periodicRate(input.annualRatePercent, input.frequency);
  return multiply(perPeriod, annuityFactor(rate, count));
}
