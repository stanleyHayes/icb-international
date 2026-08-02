import { listParam } from './rule.params.js';
import { fired, notFired, type RuleEvaluator } from './rule.types.js';

/**
 * Merchant category risk.
 *
 * Gambling, crypto brokers, wire-transfer agents and prepaid top-ups are where a stolen card is
 * turned into something the bank cannot claw back, so they carry weight. The lists are parameters
 * rather than constants because "which merchants worry us" is a policy question the fraud team
 * revises constantly, and they should not need a deployment to answer it.
 */

/** Gambling, crypto brokers, money transmitters, prepaid top-ups, wire services. */
const DEFAULT_HIGH_RISK = '7995,7801,7802,7800,6051,6050,6540,4829,5967,5122,6211';

/** Bars, jewellery, electronics resale — elevated, not alarming. */
const DEFAULT_ELEVATED = '5813,5921,5944,5732,5399,7994';

const ELEVATED_SEVERITY = 0.5;

export const mccRiskRule: RuleEvaluator = (context, parameters) => {
  const highRisk = listParam(parameters, 'highRiskMccs', DEFAULT_HIGH_RISK);
  const elevated = listParam(parameters, 'elevatedMccs', DEFAULT_ELEVATED);
  const threshold = `outside the ${highRisk.length + elevated.length} watched merchant categories`;

  if (!context.mcc) {
    return notFired('No merchant category code on this event', threshold);
  }

  if (highRisk.includes(context.mcc)) {
    return fired(`Merchant category ${context.mcc} is on the high-risk list`, threshold, 1);
  }
  if (elevated.includes(context.mcc)) {
    return fired(
      `Merchant category ${context.mcc} is on the elevated-risk list`,
      threshold,
      ELEVATED_SEVERITY,
    );
  }

  return notFired(`Merchant category ${context.mcc} is not on a watched list`, threshold);
};
