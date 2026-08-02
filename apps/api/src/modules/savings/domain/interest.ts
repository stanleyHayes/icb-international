import { roundMinorUnits } from '@icb/money';

import { clamp, daysBetween } from './date-maths.js';

/**
 * Term-deposit interest, ACT/365.
 *
 * Actual days elapsed over a fixed 365-day year — the convention used for retail term deposits
 * in most sterling- and cedi-denominated markets. It is stated here once so that the accrual
 * job, the maturity projection, and the break quote can never disagree about what a day is
 * worth: all three call the same function.
 *
 * Everything is integer minor units in and out. Daily accrual is computed from the *cumulative*
 * figure rather than by adding a rounded daily amount, because rounding once per day for 365
 * days drifts by up to half a minor unit a day — real money over a portfolio.
 *
 * Pure functions: no clock, no database. The caller supplies the date to value at.
 */

/** ACT/365 fixed. Leap years accrue 366 days of interest, which is the point of the convention. */
export const DAYS_PER_YEAR = 365;

/** The four dates and amounts that define a deposit's economics. */
export interface DepositTerms {
  readonly principalMinorUnits: number;
  /** Annual nominal rate as a fraction, e.g. `0.0525` for 5.25%. */
  readonly rate: number;
  readonly openedOn: string;
  readonly maturesOn: string;
}

/** Unrounded interest for a single day. Kept fractional so accruals do not drift. */
export function dailyInterestMinorUnits(principalMinorUnits: number, rate: number): number {
  if (principalMinorUnits <= 0 || rate <= 0) {
    return 0;
  }
  return (principalMinorUnits * rate) / DAYS_PER_YEAR;
}

/** Interest earned over `days` at `rate`, rounded once to a whole minor unit. */
export function accruedInterestMinorUnits(
  principalMinorUnits: number,
  rate: number,
  days: number,
): number {
  if (days <= 0) {
    return 0;
  }
  return roundMinorUnits(dailyInterestMinorUnits(principalMinorUnits, rate) * days, 'half-even');
}

/** Contracted life of the deposit in days. */
export function termDays(terms: DepositTerms): number {
  return Math.max(0, daysBetween(terms.openedOn, terms.maturesOn));
}

/** Days actually elapsed at `onIso`, never negative and never beyond maturity. */
export function elapsedDays(terms: DepositTerms, onIso: string): number {
  return clamp(daysBetween(terms.openedOn, onIso), 0, termDays(terms));
}

/** Interest earned to `onIso`. Stops at maturity: a matured deposit no longer earns its rate. */
export function accruedInterestOn(terms: DepositTerms, onIso: string): number {
  return accruedInterestMinorUnits(
    terms.principalMinorUnits,
    terms.rate,
    elapsedDays(terms, onIso),
  );
}

/** Interest the deposit pays if it is held to maturity. */
export function projectedInterestMinorUnits(terms: DepositTerms): number {
  return accruedInterestMinorUnits(terms.principalMinorUnits, terms.rate, termDays(terms));
}

/** Principal plus full-term interest — the figure quoted when the deposit is opened. */
export function maturityValueMinorUnits(terms: DepositTerms): number {
  return terms.principalMinorUnits + projectedInterestMinorUnits(terms);
}

/** How far through the contracted term `onIso` falls, as a fraction of 0…1. */
export function elapsedFraction(terms: DepositTerms, onIso: string): number {
  const total = termDays(terms);
  if (total <= 0) {
    return 1;
  }
  return clamp(elapsedDays(terms, onIso) / total, 0, 1);
}

/**
 * Early-break penalty ladder.
 *
 * The forfeit falls as the deposit matures: breaking in the first quarter of the term gives up
 * all the interest earned so far, breaking in the last quarter gives up a fifth of it. The
 * principal is never at risk — a term deposit that could return less than it took is not a
 * deposit product.
 */
export const BREAK_PENALTY_LADDER: readonly { readonly throughTerm: number; readonly share: number }[] =
  [
    { throughTerm: 0.25, share: 1 },
    { throughTerm: 0.5, share: 0.75 },
    { throughTerm: 0.75, share: 0.5 },
    { throughTerm: 1, share: 0.2 },
  ];

/** Share of accrued interest forfeited when breaking at `elapsed` through the term. */
export function breakForfeitShare(elapsed: number): number {
  const bounded = clamp(elapsed, 0, 1);
  for (const step of BREAK_PENALTY_LADDER) {
    if (bounded < step.throughTerm) {
      return step.share;
    }
  }
  return BREAK_PENALTY_LADDER[BREAK_PENALTY_LADDER.length - 1]?.share ?? 0;
}

/** Everything the customer is shown before they confirm an early break. */
export interface BreakMaths {
  readonly principalMinorUnits: number;
  readonly accruedInterestMinorUnits: number;
  readonly forfeitShare: number;
  /** Accrued interest clawed back. Never exceeds what was accrued. */
  readonly penaltyMinorUnits: number;
  /** Interest the customer keeps: accrued less the penalty. */
  readonly netInterestMinorUnits: number;
  readonly netProceedsMinorUnits: number;
  /**
   * Total interest given up by breaking rather than holding — the penalty *plus* the interest
   * the remaining term would have paid. The number that actually answers "what does this cost
   * me?", which the penalty alone does not.
   */
  readonly interestForfeitedMinorUnits: number;
}

/** Price an early break as at `onIso`. Deterministic: the same inputs always quote the same. */
export function quoteBreak(terms: DepositTerms, onIso: string): BreakMaths {
  const accrued = accruedInterestOn(terms, onIso);
  const forfeitShare = breakForfeitShare(elapsedFraction(terms, onIso));
  const penalty = Math.min(accrued, roundMinorUnits(accrued * forfeitShare, 'half-up'));
  const netInterest = accrued - penalty;

  return {
    principalMinorUnits: terms.principalMinorUnits,
    accruedInterestMinorUnits: accrued,
    forfeitShare,
    penaltyMinorUnits: penalty,
    netInterestMinorUnits: netInterest,
    netProceedsMinorUnits: terms.principalMinorUnits + netInterest,
    interestForfeitedMinorUnits: projectedInterestMinorUnits(terms) - netInterest,
  };
}
