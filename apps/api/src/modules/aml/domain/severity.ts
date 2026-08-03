import type { AlertSeverity, AmlAlertKind } from '@icb/contracts';

import { STRONG_MATCH } from '../../kyc/domain/watchlist.js';
import { CTR_THRESHOLD_MINOR_UNITS, SEVERITY_ESCALATION_MULTIPLE } from '../aml.constants.js';
import type { ScenarioHit } from './scenario.types.js';

/**
 * How loudly the queue should shout about a hit.
 *
 * The base band is a property of the *kind*: a sanctions name-match is critical before anyone
 * reads the detail, while a round-amount habit only matters in aggregate. Two things make a hit
 * one band louder than its base: money well past the reporting line, and a name match strong
 * enough that "different person" stops being plausible. Severity never drops below base — an
 * analyst downgrades, the rule does not.
 */
const BASE_SEVERITY: Readonly<Record<AmlAlertKind, AlertSeverity>> = {
  sanctions_match: 'critical',
  pep_match: 'high',
  adverse_media: 'medium',
  structuring: 'high',
  rapid_movement: 'medium',
  round_amount_pattern: 'low',
  high_risk_corridor: 'high',
  threshold_aggregation: 'high',
};

const RANK: readonly AlertSeverity[] = ['low', 'medium', 'high', 'critical'];

function louder(severity: AlertSeverity): AlertSeverity {
  const index = RANK.indexOf(severity);
  return RANK[Math.min(index + 1, RANK.length - 1)] ?? 'critical';
}

export function severityFor(hit: ScenarioHit): AlertSeverity {
  const base = BASE_SEVERITY[hit.kind];
  const bigMoney =
    hit.aggregateMinorUnits !== null &&
    hit.aggregateMinorUnits >= CTR_THRESHOLD_MINOR_UNITS * SEVERITY_ESCALATION_MULTIPLE;
  const strongName = hit.matchScore !== null && hit.matchScore >= STRONG_MATCH;
  return bigMoney || strongName ? louder(base) : base;
}
