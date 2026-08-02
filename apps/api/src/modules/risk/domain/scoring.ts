import type { AlertSeverity, FiredRule, RiskDecision } from '@icb/contracts';

/**
 * Turning fired rules into a score and a decision.
 *
 * The score is a *saturating sum* of contributions rather than a normalised average. An average
 * dilutes: a transaction that trips structuring alone would score low simply because eight other
 * rules stayed quiet, which is precisely backwards. One rule breaking badly enough must be able to
 * stop a payment on its own.
 */

export const MAX_SCORE = 100;

export interface DecisionThresholds {
  /** At or above this, the customer must prove it is them. */
  readonly challenge: number;
  /** At or above this, a human looks before the money moves. */
  readonly review: number;
  /** At or above this, the bank refuses. */
  readonly block: number;
}

export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = {
  challenge: 25,
  review: 50,
  block: 80,
};

/** Thresholds must be strictly increasing, or a score could fall into two bands at once. */
export function normaliseThresholds(thresholds: DecisionThresholds): DecisionThresholds {
  const challenge = clampScore(thresholds.challenge);
  const review = Math.max(challenge, clampScore(thresholds.review));
  return { challenge, review, block: Math.max(review, clampScore(thresholds.block)) };
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(MAX_SCORE, Math.max(0, Math.round(value)));
}

export function scoreOf(firedRules: readonly FiredRule[]): number {
  const total = firedRules.reduce((sum, rule) => sum + rule.contribution, 0);
  return clampScore(total);
}

export function decideFrom(score: number, thresholds: DecisionThresholds): RiskDecision {
  const bands = normaliseThresholds(thresholds);
  if (score >= bands.block) {
    return 'block';
  }
  if (score >= bands.review) {
    return 'review';
  }
  if (score >= bands.challenge) {
    return 'challenge';
  }
  return 'allow';
}

/** How loudly the case queue should shout about this one. */
export function severityFor(decision: RiskDecision, score: number): AlertSeverity {
  if (decision === 'block' || score >= MAX_SCORE) {
    return 'critical';
  }
  if (decision === 'review') {
    return 'high';
  }
  if (decision === 'challenge') {
    return 'medium';
  }
  return 'low';
}

/** A decision only a human may release. Everything else settles without an analyst. */
export function needsCase(decision: RiskDecision): boolean {
  return decision === 'review' || decision === 'block';
}
