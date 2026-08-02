import type { FiredRule, RiskAssessment, RiskDecision } from '@icb/contracts';
import { type CurrencyCode } from '@icb/money';

import { describeAmount } from './rules/rule.params.js';

/**
 * The explanation.
 *
 * Mandatory, not decorative. A customer whose payment is stopped is entitled to know why, an
 * analyst has to justify releasing it, and a regulator will one day ask how the number was
 * reached. So the narrative is generated from the same fired rules that produced the score —
 * it cannot drift from the decision, because it is derived from it.
 */

const DECISION_SENTENCE: Readonly<Record<RiskDecision, string>> = {
  allow: 'Allowed without friction.',
  challenge: 'Challenged: the customer must re-authenticate before this proceeds.',
  review: 'Held for review: an analyst must release or block this before value moves.',
  block: 'Blocked: the bank has refused this outright.',
};

export interface NarrativeInput {
  readonly subjectType: RiskAssessment['subjectType'];
  readonly subjectId: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly score: number;
  readonly decision: RiskDecision;
  readonly firedRules: readonly FiredRule[];
  readonly rulesConsidered: number;
}

function subjectPhrase(input: NarrativeInput): string {
  const subject = input.subjectType.replaceAll('_', ' ');
  const amount = describeAmount(input.amountMinorUnits, input.currency);
  return `${subject} ${input.subjectId} for ${amount}`;
}

function ruleSentence(rule: FiredRule): string {
  const against = rule.threshold ? `, against a threshold of ${rule.threshold}` : '';
  return `• ${rule.label} (+${rule.contribution} of a possible ${rule.weight}): ${rule.observed}${against}.`;
}

/** The paragraph an analyst pastes into a case note, verbatim. */
export function buildNarrative(input: NarrativeInput): string {
  const header =
    `Risk assessment of ${subjectPhrase(input)} scored ${input.score}/100. ` +
    `${input.firedRules.length} of ${input.rulesConsidered} active rules fired. ` +
    DECISION_SENTENCE[input.decision];

  if (input.firedRules.length === 0) {
    return `${header}\n\nNo rule fired: nothing in this event departed from the customer's established pattern.`;
  }

  const lines = input.firedRules.map(ruleSentence).join('\n');
  const driver = input.firedRules[0];
  const footer = driver
    ? `\nThe largest single driver was "${driver.label}", contributing ${driver.contribution} of the ${input.score} points.`
    : '';

  return `${header}\n\nWhat fired:\n${lines}\n${footer}`;
}
