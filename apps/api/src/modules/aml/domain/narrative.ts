import type { AlertSeverity, AmlAlertKind } from '@icb/contracts';

import type { ScenarioHit } from './scenario.types.js';

/**
 * The narrative builder.
 *
 * An alert without a narrative is a row in a queue; an alert with one is a case an analyst can
 * pick up cold. The same builder also writes the first draft of the SAR/CTR narrative — a human
 * edits it before filing, but nobody should ever start from a blank page at 16:45 on a Friday.
 */

const LEADS: Readonly<Record<AmlAlertKind, string>> = {
  sanctions_match: 'Screening matched the subject against the simulated sanctions list.',
  pep_match: 'Screening identified the subject as a politically exposed person.',
  adverse_media: 'Adverse-media screening returned relevant negative coverage.',
  structuring: 'Transaction monitoring detected a pattern consistent with structuring.',
  rapid_movement: 'Transaction monitoring detected funds moving through the accounts at speed.',
  round_amount_pattern: 'Transaction monitoring detected a repeated round-amount pattern.',
  high_risk_corridor: 'Transaction monitoring detected outbound value to a high-risk corridor.',
  threshold_aggregation: 'Same-day cash-in aggregation reached the reporting threshold.',
};

export interface NarrativeInput {
  readonly customerName: string;
  readonly severity: AlertSeverity;
  readonly hit: ScenarioHit;
}

/** The analyst-facing paragraph stored on the alert when it is raised. */
export function buildAlertNarrative(input: NarrativeInput): string {
  const sentences = [LEADS[input.hit.kind], input.hit.matchDetail];
  if (input.hit.relatedTransactionIds.length > 0) {
    sentences.push(`${input.hit.relatedTransactionIds.length} related transaction(s) are attached.`);
  }
  return `${input.customerName} (${input.severity} severity). ${sentences.join(' ')}`;
}

export interface ReportDraftInput {
  readonly reportKind: 'sar' | 'ctr';
  readonly reference: string;
  readonly customerName: string;
  readonly customerId: string;
  readonly alertKind: AmlAlertKind;
  readonly matchDetail: string;
  readonly aggregateMinorUnits: number | null;
  readonly currency: string | null;
  readonly transactionCount: number;
  readonly preparedBy: string;
  readonly preparedAt: Date;
}

/** The structured first draft of a regulatory report, stored with the filing. */
export function buildReportDraft(input: ReportDraftInput): string {
  const title =
    input.reportKind === 'sar'
      ? 'SUSPICIOUS ACTIVITY REPORT — DRAFT'
      : 'CURRENCY TRANSACTION REPORT — DRAFT';
  const amount =
    input.aggregateMinorUnits !== null && input.currency !== null
      ? `${input.aggregateMinorUnits} minor units ${input.currency}`
      : 'not aggregated';

  return [
    title,
    `Reference: ${input.reference}`,
    `Subject: ${input.customerName} (${input.customerId})`,
    `Activity type: ${input.alertKind}`,
    `Summary: ${input.matchDetail}`,
    `Aggregate amount: ${amount}`,
    `Related transactions: ${input.transactionCount}`,
    `Prepared by: ${input.preparedBy} at ${input.preparedAt.toISOString()}`,
    'This draft was generated from the alert record and must be reviewed by the filing officer before submission.',
  ].join('\n');
}
