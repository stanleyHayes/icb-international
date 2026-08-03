import { CTR_CASH_IN_TYPES, CTR_THRESHOLD_MINOR_UNITS } from '../aml.constants.js';
import type { FlowPoint, ScenarioHit } from './scenario.types.js';

/**
 * CTR threshold aggregation.
 *
 * A currency transaction report is owed when a customer's cash-in across one business day reaches
 * the threshold — *in aggregate*, not per transaction. That is what makes this different from a
 * simple large-transaction rule: five $2,000 deposits at different branches on the same day are
 * one reportable event. Days are UTC calendar days, matching the value-date convention the rest
 * of the bank books against.
 */

export interface DailyCashAggregate {
  readonly day: string;
  readonly currency: string;
  readonly totalMinorUnits: number;
  readonly transactionIds: readonly string[];
}

/** Group cash-equivalent credits by UTC day within each currency. */
export function aggregateCashByDay(flows: readonly FlowPoint[]): DailyCashAggregate[] {
  const aggregates = new Map<string, { total: number; ids: string[]; day: string; currency: string }>();

  for (const flow of flows) {
    if (flow.direction !== 'credit' || !CTR_CASH_IN_TYPES.includes(flow.transactionType)) {
      continue;
    }
    const day = flow.at.toISOString().slice(0, 10);
    const key = `${flow.currency}:${day}`;
    const entry = aggregates.get(key) ?? { total: 0, ids: [], day, currency: flow.currency };
    entry.total += flow.minorUnits;
    entry.ids.push(flow.transactionId);
    aggregates.set(key, entry);
  }

  return [...aggregates.values()].map((entry) => ({
    day: entry.day,
    currency: entry.currency,
    totalMinorUnits: entry.total,
    transactionIds: entry.ids,
  }));
}

/** The strongest day over the threshold, or null when every day stayed under it. */
export function detectThresholdAggregation(flows: readonly FlowPoint[]): ScenarioHit | null {
  let worst: DailyCashAggregate | null = null;
  for (const aggregate of aggregateCashByDay(flows)) {
    const over = aggregate.totalMinorUnits >= CTR_THRESHOLD_MINOR_UNITS;
    if (over && (worst === null || aggregate.totalMinorUnits > worst.totalMinorUnits)) {
      worst = aggregate;
    }
  }

  if (worst === null) {
    return null;
  }
  return {
    kind: 'threshold_aggregation',
    matchDetail:
      `Cash-in of ${worst.totalMinorUnits} minor units ${worst.currency} across ` +
      `${worst.transactionIds.length} transaction(s) on ${worst.day} reached the reporting threshold`,
    matchScore: null,
    relatedTransactionIds: worst.transactionIds,
    aggregateMinorUnits: worst.totalMinorUnits,
    currency: worst.currency,
  };
}
