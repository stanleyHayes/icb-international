import type {
  TransferDetail,
  TransferRail,
  TransferStatus,
  TransferSummary,
} from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { CANCELLABLE_STATUSES } from '../domain/transfers.constants.js';
import type { TransferDoc } from './transfer.schemas.js';

/** Persistence → contract. Shared by the list and single-transfer reads so they cannot diverge. */
export function toTransferSummary(row: TransferDoc, fromLabel: string): TransferSummary {
  return {
    id: row._id,
    reference: row.reference,
    status: row.status as TransferStatus,
    rail: row.rail as TransferRail,
    fromAccountId: row.fromAccountId,
    fromAccountLabel: fromLabel,
    recipientName: row.recipientName,
    recipientMasked: row.recipientMasked,
    debitAmount: toMoneyDto(row.debitMinorUnits, row.currency),
    creditAmount: toMoneyDto(row.creditMinorUnits, row.creditCurrency ?? row.currency),
    createdAt: row.createdAt.toISOString(),
    executeAt: (row.executeAt ?? row.createdAt).toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    recurring: row.recurring,
  };
}

/** The full read model: terms, fees, FX, schedule and the customer-visible timeline. */
export function toTransferDetail(row: TransferDoc, fromLabel: string): TransferDetail {
  return {
    ...toTransferSummary(row, fromLabel),
    destination: row.destination as TransferDetail['destination'],
    fees: row.feeBreakdown.map((fee) => ({
      code: fee.code,
      label: fee.label,
      amount: toMoneyDto(fee.minorUnits, row.currency),
    })),
    totalFees: toMoneyDto(row.feeMinorUnits, row.currency),
    fx: fxDetail(row),
    note: row.note,
    schedule: scheduleDetail(row),
    nextOccurrenceAt: row.nextOccurrenceAt?.toISOString() ?? null,
    transactionId: row.transactionId,
    estimatedArrival: row.estimatedArrival.toISOString(),
    timeline: row.timeline.map((event) => ({
      at: event.at.toISOString(),
      status: event.status as TransferStatus,
      label: event.label,
      detail: event.detail,
    })),
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    cancellable: CANCELLABLE_STATUSES.includes(row.status as TransferStatus),
  };
}

function fxDetail(row: TransferDoc): TransferDetail['fx'] {
  if (row.fx === null) {
    return null;
  }
  return {
    fromAmount: toMoneyDto(row.fx.fromMinorUnits, row.fx.fromCurrency),
    toAmount: toMoneyDto(row.fx.toMinorUnits, row.fx.toCurrency),
    rate: row.fx.rate,
    spreadBps: row.fx.spreadBps,
  };
}

function scheduleDetail(row: TransferDoc): TransferDetail['schedule'] {
  if (row.schedule === null) {
    return null;
  }
  return {
    ...(row.schedule.rrule ? { rrule: row.schedule.rrule } : {}),
    startsOn: row.schedule.startsOn,
    ...(row.schedule.endsOn ? { endsOn: row.schedule.endsOn } : {}),
    ...(row.schedule.maxOccurrences !== null
      ? { maxOccurrences: row.schedule.maxOccurrences }
      : {}),
  };
}
