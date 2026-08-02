import type { TransferRail, TransferSummary } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { TransferDoc } from './transfer.schemas.js';

/** Persistence → contract. Shared by the list and single-transfer reads so they cannot diverge. */
export function toTransferSummary(row: TransferDoc, fromLabel: string): TransferSummary {
  return {
    id: row._id,
    reference: row.reference,
    status: row.status as TransferSummary['status'],
    rail: row.rail as TransferRail,
    fromAccountId: row.fromAccountId,
    fromAccountLabel: fromLabel,
    recipientName: row.recipientName,
    recipientMasked: row.recipientMasked,
    debitAmount: toMoneyDto(row.debitMinorUnits, row.currency),
    creditAmount: toMoneyDto(row.creditMinorUnits, row.currency),
    createdAt: row.createdAt.toISOString(),
    executeAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    recurring: false,
  };
}
