import type { TransferStatus } from '@icb/contracts';

import type {
  PreparedTransfer,
  TransferExecution,
} from '../application/transfer-pipeline.types.js';
import type { ScheduleEmb, TimelineEmb, TransferDoc } from './transfer.schemas.js';

/**
 * The document a transfer becomes.
 *
 * Built in one pure function so the orchestrator never assembles persistence shapes inline —
 * and so a scheduled transfer and an immediate one are recorded by exactly the same code.
 */
export function buildTransferDocument(
  prepared: PreparedTransfer,
  initial: { status: TransferStatus; detail: string | null },
  schedule: ScheduleInput,
): Partial<TransferDoc> {
  return {
    _id: prepared.transferId,
    reference: prepared.reference,
    customerId: prepared.customerId,
    fromAccountId: prepared.source._id,
    destination: prepared.destination,
    rail: prepared.rail,
    status: initial.status,
    debitMinorUnits: prepared.debit.minorUnits,
    creditMinorUnits: prepared.credit.minorUnits,
    currency: prepared.debit.currency,
    creditCurrency: prepared.credit.currency,
    feeMinorUnits: prepared.totalFees.minorUnits,
    feeBreakdown: prepared.fees.map((fee) => ({
      code: fee.code,
      label: fee.label,
      minorUnits: fee.amount.minorUnits,
    })),
    fx: prepared.fx === null ? null : {
      fromMinorUnits: prepared.debit.minorUnits,
      fromCurrency: prepared.debit.currency,
      toMinorUnits: prepared.credit.minorUnits,
      toCurrency: prepared.credit.currency,
      rate: prepared.fx.rate,
      spreadBps: prepared.fx.spreadBps,
    },
    recipientName: prepared.recipientName,
    recipientMasked: prepared.recipientMasked,
    customerReference: prepared.customerReference,
    note: prepared.note,
    transactionId: null,
    railReference: null,
    estimatedArrival: prepared.now,
    executeAt: schedule.executeAt,
    schedule: schedule.schedule,
    standingOrderId: schedule.standingOrderId,
    nextOccurrenceAt: schedule.nextOccurrenceAt,
    recurring: schedule.standingOrderId !== null,
    timeline: [timelineEntry(prepared.now, initial.status, initial.detail)],
    createdAt: prepared.now,
    completedAt: null,
    failureCode: null,
    failureReason: null,
  };
}

export interface ScheduleInput {
  readonly executeAt: Date;
  readonly schedule: ScheduleEmb | null;
  readonly standingOrderId: string | null;
  readonly nextOccurrenceAt: Date | null;
}

export function timelineEntry(
  at: Date,
  status: TransferStatus,
  detail: string | null,
): TimelineEmb {
  return { at, status, label: TIMELINE_LABELS[status], detail };
}

const TIMELINE_LABELS: Readonly<Record<TransferStatus, string>> = {
  draft: 'Drafted',
  quoted: 'Quoted',
  pending_approval: 'Awaiting approval',
  scheduled: 'Scheduled',
  processing: 'Processing',
  in_settlement: 'Sent',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  returned: 'Returned by the receiving bank',
};

/** The fields an execution outcome writes onto the stored document. */
export function executionPatch(
  execution: TransferExecution,
  at: Date,
): Record<string, unknown> {
  return {
    $set: {
      status: execution.status,
      transactionId: execution.transactionId,
      railReference: execution.railReference,
      estimatedArrival: execution.estimatedArrival,
      ...(execution.status === 'completed' ? { completedAt: at } : {}),
    },
    $push: { timeline: timelineEntry(at, execution.status, execution.detail) },
  };
}

/** The fields a failure writes onto the stored document. */
export function failurePatch(
  at: Date,
  code: string,
  reason: string,
): Record<string, unknown> {
  return {
    $set: { status: 'failed', failureCode: code, failureReason: reason },
    $push: { timeline: timelineEntry(at, 'failed', reason) },
  };
}

/**
 * The next run of a standing order as its own transfer document — same terms, new identity,
 * fresh timeline. A failed run never corrupts the series because each run is its own row.
 */
export function buildNextOccurrenceDocument(input: {
  executed: TransferDoc;
  standingOrderId: string;
  orderName: string;
  schedule: ScheduleEmb;
  nextRunAt: Date;
  transferId: string;
  reference: string;
  now: Date;
}): Partial<TransferDoc> {
  const { executed } = input;
  return {
    _id: input.transferId,
    reference: input.reference,
    customerId: executed.customerId,
    fromAccountId: executed.fromAccountId,
    destination: executed.destination,
    rail: executed.rail,
    status: 'scheduled',
    debitMinorUnits: executed.debitMinorUnits,
    creditMinorUnits: executed.creditMinorUnits,
    currency: executed.currency,
    creditCurrency: executed.creditCurrency,
    feeMinorUnits: executed.feeMinorUnits,
    feeBreakdown: executed.feeBreakdown,
    fx: executed.fx,
    recipientName: executed.recipientName,
    recipientMasked: executed.recipientMasked,
    customerReference: executed.customerReference,
    note: executed.note,
    transactionId: null,
    railReference: null,
    estimatedArrival: input.nextRunAt,
    executeAt: input.nextRunAt,
    schedule: input.schedule,
    standingOrderId: input.standingOrderId,
    nextOccurrenceAt: null,
    recurring: true,
    timeline: [timelineEntry(input.now, 'scheduled', `Next run of ${input.orderName}`)],
    createdAt: input.now,
    completedAt: null,
    failureCode: null,
    failureReason: null,
  };
}
