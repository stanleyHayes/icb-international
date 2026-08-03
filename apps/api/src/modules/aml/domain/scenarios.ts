import {
  CTR_THRESHOLD_MINOR_UNITS,
  HIGH_RISK_COUNTRIES,
  MS_PER_DAY,
  MS_PER_HOUR,
  RAPID_MOVEMENT_MIN_MINOR_UNITS,
  RAPID_MOVEMENT_OUT_RATIO,
  RAPID_MOVEMENT_WINDOW_HOURS,
  ROUND_AMOUNT_MIN_COUNT,
  ROUND_AMOUNT_STEP_MINOR_UNITS,
  ROUND_AMOUNT_WINDOW_DAYS,
  STRUCTURING_LOWER_RATIO,
  STRUCTURING_MIN_COUNT,
  STRUCTURING_WINDOW_DAYS,
} from '../aml.constants.js';
import { byCurrency, type FlowPoint, type ScenarioHit } from './scenario.types.js';

/**
 * The four behavioural monitoring scenarios.
 *
 * Each is a pure function over the same flow history, so a scan is reproducible: same postings,
 * same clock, same alerts. Windows end at `now` (the ClockService instant the scan ran at) — a
 * detector that reached for wall time would silently stop firing during time-travel simulation.
 */

function withinWindow(
  flows: readonly FlowPoint[],
  now: Date,
  windowMs: number,
): FlowPoint[] {
  const since = now.getTime() - windowMs;
  return flows.filter((flow) => flow.at.getTime() >= since);
}

function sum(flows: readonly FlowPoint[]): number {
  return flows.reduce((total, flow) => total + flow.minorUnits, 0);
}

function ids(flows: readonly FlowPoint[]): string[] {
  return flows.map((flow) => flow.transactionId);
}

/** Deposits each kept just under the CTR line but summing above it — the definition of smurfing. */
export function detectStructuring(flows: readonly FlowPoint[], now: Date): ScenarioHit | null {
  const window = withinWindow(flows, now, STRUCTURING_WINDOW_DAYS * MS_PER_DAY);
  for (const [currency, group] of byCurrency(window)) {
    const candidates = group.filter(
      (flow) =>
        flow.direction === 'credit' &&
        flow.minorUnits >= CTR_THRESHOLD_MINOR_UNITS * STRUCTURING_LOWER_RATIO &&
        flow.minorUnits < CTR_THRESHOLD_MINOR_UNITS,
    );
    if (candidates.length >= STRUCTURING_MIN_COUNT && sum(candidates) >= CTR_THRESHOLD_MINOR_UNITS) {
      return {
        kind: 'structuring',
        matchDetail:
          `${candidates.length} credits between ${STRUCTURING_LOWER_RATIO * 100}% and 100% of the ` +
          `reporting threshold within ${STRUCTURING_WINDOW_DAYS} days, totalling ` +
          `${sum(candidates)} minor units ${currency}`,
        matchScore: null,
        relatedTransactionIds: ids(candidates),
        aggregateMinorUnits: sum(candidates),
        currency,
      };
    }
  }
  return null;
}

/** Money that arrives and leaves again inside the window is being moved through, not used. */
export function detectRapidMovement(flows: readonly FlowPoint[], now: Date): ScenarioHit | null {
  const window = withinWindow(flows, now, RAPID_MOVEMENT_WINDOW_HOURS * MS_PER_HOUR);
  for (const [currency, group] of byCurrency(window)) {
    const inbound = group.filter((flow) => flow.direction === 'credit');
    const outbound = group.filter((flow) => flow.direction === 'debit');
    const totalIn = sum(inbound);
    const totalOut = sum(outbound);
    const qualifies =
      totalIn >= RAPID_MOVEMENT_MIN_MINOR_UNITS && totalOut >= totalIn * RAPID_MOVEMENT_OUT_RATIO;
    if (qualifies && outbound.length > 0) {
      return {
        kind: 'rapid_movement',
        matchDetail:
          `${totalOut} of ${totalIn} minor units ${currency} received left the accounts within ` +
          `${RAPID_MOVEMENT_WINDOW_HOURS} hours`,
        matchScore: null,
        relatedTransactionIds: [...ids(inbound), ...ids(outbound)],
        aggregateMinorUnits: totalOut,
        currency,
      };
    }
  }
  return null;
}

/** A habit of exact round thousands reads as placement, not commerce. */
export function detectRoundAmounts(flows: readonly FlowPoint[], now: Date): ScenarioHit | null {
  const window = withinWindow(flows, now, ROUND_AMOUNT_WINDOW_DAYS * MS_PER_DAY);
  for (const [currency, group] of byCurrency(window)) {
    const rounds = group.filter(
      (flow) =>
        flow.direction === 'debit' &&
        flow.minorUnits >= ROUND_AMOUNT_STEP_MINOR_UNITS &&
        flow.minorUnits % ROUND_AMOUNT_STEP_MINOR_UNITS === 0,
    );
    if (rounds.length >= ROUND_AMOUNT_MIN_COUNT) {
      return {
        kind: 'round_amount_pattern',
        matchDetail:
          `${rounds.length} outbound transfers of exact round amounts within ` +
          `${ROUND_AMOUNT_WINDOW_DAYS} days, totalling ${sum(rounds)} minor units ${currency}`,
        matchScore: null,
        relatedTransactionIds: ids(rounds),
        aggregateMinorUnits: sum(rounds),
        currency,
      };
    }
  }
  return null;
}

/** Outbound value to a high-risk corridor, however it was earned. */
export function detectHighRiskCorridor(flows: readonly FlowPoint[]): ScenarioHit | null {
  for (const [currency, group] of byCurrency(flows)) {
    const exposed = group.filter(
      (flow) =>
        flow.direction === 'debit' &&
        flow.destinationCountry !== null &&
        HIGH_RISK_COUNTRIES.includes(flow.destinationCountry),
    );
    if (exposed.length > 0) {
      const countries = [...new Set(exposed.map((flow) => flow.destinationCountry))].sort((a, b) =>
        (a ?? '').localeCompare(b ?? ''),
      );
      return {
        kind: 'high_risk_corridor',
        matchDetail:
          `${exposed.length} outbound transfer(s) to high-risk corridor(s) ${countries.join(', ')} ` +
          `totalling ${sum(exposed)} minor units ${currency}`,
        matchScore: null,
        relatedTransactionIds: ids(exposed),
        aggregateMinorUnits: sum(exposed),
        currency,
      };
    }
  }
  return null;
}
