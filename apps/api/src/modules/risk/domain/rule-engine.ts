import type { FiredRule, RiskRule } from '@icb/contracts';

import { evaluatorFor } from './rules/index.js';
import { clamp01 } from './rules/rule.params.js';
import type { RuleContext, RuleOutcome } from './rules/rule.types.js';

/**
 * The engine: run every enabled rule over one context and collect what fired.
 *
 * Two properties matter more than speed here. First, one badly configured rule must not take the
 * payment path down — an evaluator that throws is recorded as a rule that did not fire, and the
 * remaining rules still decide. Second, the output carries per-rule attribution, because a score
 * without attribution cannot be appealed, audited, or explained to a regulator.
 */

/** A rule and what it saw, whether or not it fired. Used by the diagnostics view. */
export interface RuleEvaluation {
  readonly rule: RiskRule;
  readonly outcome: RuleOutcome;
}

function toFiredRule(rule: RiskRule, outcome: RuleOutcome): FiredRule {
  return {
    code: rule.code,
    label: rule.label,
    weight: rule.weight,
    contribution: Math.round(rule.weight * clamp01(outcome.contribution)),
    observed: outcome.observed,
    threshold: outcome.threshold,
  };
}

/** Run one rule, converting a misconfiguration into silence rather than an outage. */
export function evaluateRule(rule: RiskRule, context: RuleContext): RuleOutcome | null {
  const evaluator = evaluatorFor(rule.kind);
  if (!evaluator) {
    return null;
  }
  try {
    return evaluator(context, rule.parameters);
  } catch {
    return null;
  }
}

/** Every enabled rule, evaluated. Disabled rules are not run at all. */
export function evaluateAll(
  rules: readonly RiskRule[],
  context: RuleContext,
): RuleEvaluation[] {
  const evaluations: RuleEvaluation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }
    const outcome = evaluateRule(rule, context);
    if (outcome) {
      evaluations.push({ rule, outcome });
    }
  }
  return evaluations;
}

/** Only the rules that fired, heaviest contribution first — the order the case note reads in. */
export function firedRulesFrom(evaluations: readonly RuleEvaluation[]): FiredRule[] {
  return evaluations
    .filter((evaluation) => evaluation.outcome.fired)
    .map((evaluation) => toFiredRule(evaluation.rule, evaluation.outcome))
    .sort((left, right) => right.contribution - left.contribution);
}

export function runRules(rules: readonly RiskRule[], context: RuleContext): FiredRule[] {
  return firedRulesFrom(evaluateAll(rules, context));
}
