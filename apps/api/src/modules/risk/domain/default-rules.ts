import type { RiskRuleKind, RuleParameters } from './rules/rule.types.js';

/**
 * The shipped rule set.
 *
 * Seeded once per environment and then owned by the fraud team: weights, parameters and the
 * on/off switch are edited through the admin console and are *never* overwritten by a redeploy.
 * That is a deliberate operational choice — a bank cannot have a release quietly reverting a
 * threshold that was tightened at 02:00 during an incident.
 *
 * Weights sum to more than 100 on purpose. The score saturates, so a single rule breaking badly
 * can stop a payment without needing every other rule to agree with it.
 */
export interface RuleSeed {
  readonly code: string;
  readonly label: string;
  readonly description: string;
  readonly kind: RiskRuleKind;
  readonly weight: number;
  readonly parameters: RuleParameters;
}

export const DEFAULT_RULES: readonly RuleSeed[] = [
  {
    code: 'VELOCITY_BURST',
    label: 'Transaction velocity',
    description:
      'Counts movements in a rolling window. A drained account is drained quickly, so burst ' +
      'count is the earliest cheap signal of a compromised credential.',
    kind: 'velocity',
    weight: 18,
    parameters: { windowMinutes: 60, maxCount: 5 },
  },
  {
    code: 'AMOUNT_ANOMALY',
    label: 'Unusual amount for this customer',
    description:
      "Compares the amount against the customer's own distribution as a z-score, so a customer " +
      'who always moves large sums is not punished for doing it again.',
    kind: 'amount_anomaly',
    weight: 22,
    parameters: { minSamples: 5, zThreshold: 3, deviationFloorPercent: 10 },
  },
  {
    code: 'NEW_BENEFICIARY',
    label: 'First payment to this beneficiary',
    description:
      'Material value leaving to a payee never paid before. Weak alone, strong in combination ' +
      'with a new device or an unusual amount.',
    kind: 'new_beneficiary',
    weight: 12,
    parameters: { minAmountMinorUnits: 50_000 },
  },
  {
    code: 'GEO_VELOCITY',
    label: 'Impossible travel',
    description:
      'Implied travel speed between the last observed country and this one. Catches one ' +
      'credential being used by two people in two places.',
    kind: 'geo_velocity',
    weight: 20,
    parameters: { maxKph: 900, minHoursBetweenCountries: 4 },
  },
  {
    code: 'DEVICE_CHANGE',
    label: 'Unrecognised device',
    description:
      'Money moving from hardware this customer has never used. Silent on a first device, ' +
      'because there is nothing to have changed from.',
    kind: 'device_change',
    weight: 14,
    parameters: { minAmountMinorUnits: 20_000 },
  },
  {
    code: 'MCC_RISK',
    label: 'High-risk merchant category',
    description:
      'Gambling, crypto brokers, money transmitters and prepaid top-ups — where stolen value is ' +
      'converted into something the bank cannot recover.',
    kind: 'mcc_risk',
    weight: 14,
    parameters: {
      highRiskMccs: '7995,7801,7802,7800,6051,6050,6540,4829,5967,5122,6211',
      elevatedMccs: '5813,5921,5944,5732,5399,7994',
    },
  },
  {
    code: 'ODD_HOURS',
    label: 'Overnight activity',
    description:
      'Activity in the hours the customer is normally asleep. The lightest rule in the set; it ' +
      'earns its place only by combining with others.',
    kind: 'time_of_day',
    weight: 6,
    parameters: { startHourUtc: 1, endHourUtc: 5 },
  },
  {
    code: 'DORMANT_REACTIVATION',
    label: 'Dormant account reactivated',
    description:
      'A long-silent account suddenly moving material value — the preferred vehicle for both ' +
      'account takeover and mule activity.',
    kind: 'dormant_reactivation',
    weight: 12,
    parameters: { dormantDays: 90, minAmountMinorUnits: 100_000 },
  },
  {
    code: 'STRUCTURING',
    label: 'Structuring below the reporting line',
    description:
      'Repeated amounts parked just under a reporting threshold. Counts only amounts inside the ' +
      'band, so ordinary mixed spending does not register.',
    kind: 'structuring',
    weight: 25,
    parameters: {
      reportingThresholdMinorUnits: 1_000_000,
      bandPercent: 10,
      minOccurrences: 3,
      windowHours: 72,
    },
  },
];
