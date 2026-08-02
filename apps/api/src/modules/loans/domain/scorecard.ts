import type { LoanDecision, ScorecardFactor } from '@icb/contracts';

import {
  debtServiceRatio,
  loanToIncome,
  monthlySurplus,
  scoreFactors,
  TOTAL_WEIGHT,
  type ScorecardInput,
} from './scorecard-factors.js';

/**
 * The scorecard.
 *
 * Deterministic by design: the same application always produces the same score, so a decision can
 * be reproduced on demand months later when a customer asks why. There is no randomness, no model
 * drift, and no hidden state — only the declared figures, the relationship, and the applicant's
 * existing behaviour.
 */

export type ScoreBand = LoanDecision['band'];

export interface ScorecardResult {
  readonly score: number;
  readonly band: ScoreBand;
  readonly factors: ScorecardFactor[];
  readonly debtServiceRatio: number;
  readonly loanToIncome: number;
  readonly monthlySurplusMinorUnits: number;
}

/** Lower bound of each band, richest first. */
const BANDS: readonly { readonly floor: number; readonly band: ScoreBand }[] = [
  { floor: 800, band: 'excellent' },
  { floor: 680, band: 'good' },
  { floor: 560, band: 'fair' },
  { floor: 440, band: 'poor' },
  { floor: 0, band: 'very_poor' },
];

export function bandFor(score: number): ScoreBand {
  return BANDS.find((entry) => score >= entry.floor)?.band ?? 'very_poor';
}

export function score(input: ScorecardInput): ScorecardResult {
  const factors = scoreFactors(input);
  const total = factors.reduce((running, factor) => running + factor.contribution, 0);
  const bounded = Math.min(TOTAL_WEIGHT, Math.max(0, Math.round(total)));

  return {
    score: bounded,
    band: bandFor(bounded),
    factors,
    debtServiceRatio: debtServiceRatio(input),
    loanToIncome: loanToIncome(input),
    monthlySurplusMinorUnits: monthlySurplus(input).minorUnits,
  };
}

export type { ScorecardInput };
