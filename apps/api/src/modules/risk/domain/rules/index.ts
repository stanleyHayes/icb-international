import { amountAnomalyRule } from './amount-anomaly.rule.js';
import { deviceChangeRule } from './device-change.rule.js';
import { dormantReactivationRule } from './dormant-reactivation.rule.js';
import { geoVelocityRule } from './geo-velocity.rule.js';
import { mccRiskRule } from './mcc-risk.rule.js';
import { newBeneficiaryRule } from './new-beneficiary.rule.js';
import { structuringRule } from './structuring.rule.js';
import { timeOfDayRule } from './time-of-day.rule.js';
import { velocityRule } from './velocity.rule.js';
import type { RiskRuleKind, RuleEvaluator } from './rule.types.js';

/**
 * The rule registry.
 *
 * A stored rule row names a `kind`; this map is where that name becomes behaviour. Adding a rule
 * is therefore one new pure function plus one entry here — the engine, the scoring, the narrative
 * and the case queue all pick it up without modification.
 *
 * `allow_list` and `deny_list` exist in the contract vocabulary but have no evaluator yet, so the
 * map is partial and the engine skips a kind it cannot evaluate rather than throwing inside a
 * payment.
 */
export const RULE_EVALUATORS: Readonly<Partial<Record<RiskRuleKind, RuleEvaluator>>> = {
  velocity: velocityRule,
  amount_anomaly: amountAnomalyRule,
  new_beneficiary: newBeneficiaryRule,
  geo_velocity: geoVelocityRule,
  device_change: deviceChangeRule,
  mcc_risk: mccRiskRule,
  time_of_day: timeOfDayRule,
  dormant_reactivation: dormantReactivationRule,
  structuring: structuringRule,
};

export function evaluatorFor(kind: RiskRuleKind): RuleEvaluator | undefined {
  return RULE_EVALUATORS[kind];
}

export {
  amountAnomalyRule,
  deviceChangeRule,
  dormantReactivationRule,
  geoVelocityRule,
  mccRiskRule,
  newBeneficiaryRule,
  structuringRule,
  timeOfDayRule,
  velocityRule,
};
export * from './rule.params.js';
export * from './rule.types.js';
