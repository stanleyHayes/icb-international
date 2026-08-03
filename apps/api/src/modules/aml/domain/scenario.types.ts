import type { AmlAlertKind } from '@icb/contracts';

/**
 * One movement of value across a customer's accounts, flattened for the detectors.
 *
 * Direction is from the customer's perspective, matching the ledger entry on their account:
 * `credit` is money in, `debit` is money out. Everything a scenario is allowed to know about a
 * transaction is here — a detector that needs more is a detector asking for a data change, not
 * one that should be querying.
 */
export interface FlowPoint {
  readonly transactionId: string;
  readonly direction: 'credit' | 'debit';
  /** Integer minor units, always positive (N3). */
  readonly minorUnits: number;
  readonly currency: string;
  readonly transactionType: string;
  readonly at: Date;
  /** ISO country of the destination for outbound international transfers, else null. */
  readonly destinationCountry: string | null;
  readonly counterpartyName: string | null;
}

/**
 * What a fired scenario hands to the alert service.
 *
 * `matchDetail` is the human sentence — the analyst reads it before any number. `matchScore` is
 * only meaningful for screening hits (name similarity); behavioural scenarios leave it null
 * rather than invent a confidence they do not have.
 */
export interface ScenarioHit {
  readonly kind: AmlAlertKind;
  readonly matchDetail: string;
  readonly matchScore: number | null;
  readonly relatedTransactionIds: readonly string[];
  readonly aggregateMinorUnits: number | null;
  readonly currency: string | null;
}

/** Flows grouped by currency: summing across currencies would be arithmetic fiction. */
export function byCurrency(flows: readonly FlowPoint[]): Map<string, FlowPoint[]> {
  const groups = new Map<string, FlowPoint[]>();
  for (const flow of flows) {
    const group = groups.get(flow.currency) ?? [];
    group.push(flow);
    groups.set(flow.currency, group);
  }
  return groups;
}
