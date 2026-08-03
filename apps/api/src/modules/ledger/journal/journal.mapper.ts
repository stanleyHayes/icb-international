import type { TransactionStatus, TransactionType } from '@icb/contracts';

import type { PostingActor } from '../domain/posting.types.js';
import type { LedgerEntryDoc, LedgerTransactionDoc } from '../infrastructure/ledger.schemas.js';
import { toMoneyDto } from '../infrastructure/money.mapper.js';
import type { JournalEntry, JournalTransaction } from './journal.types.js';

/**
 * Persistence → wire.
 *
 * Mapping lives here so the service never thinks about wire shapes and the controller never
 * thinks about documents. The casts at this boundary trust the schema's own constraints (enums
 * on `direction`, the writer's discipline on `type`/`status`) rather than re-validating history.
 */
export function toJournalEntry(doc: LedgerEntryDoc): JournalEntry {
  return {
    id: doc._id,
    accountRef: doc.accountRef,
    direction: doc.direction,
    amount: toMoneyDto(doc.minorUnits, doc.currency),
    signedMinorUnits: doc.signedMinorUnits,
    sequence: doc.sequence,
    valueDate: doc.valueDate,
    narrative: doc.narrative,
  };
}

export function toJournalTransaction(
  doc: LedgerTransactionDoc,
  entries: readonly LedgerEntryDoc[],
): JournalTransaction {
  return {
    transactionId: doc._id,
    reference: doc.reference,
    type: doc.type as TransactionType,
    status: doc.status as TransactionStatus,
    description: doc.description,
    actor: doc.actor as PostingActor,
    valueDate: doc.valueDate,
    bookedAt: doc.bookedAt.toISOString(),
    settledAt: doc.settledAt === null ? null : doc.settledAt.toISOString(),
    reversesTransactionId: doc.reversesTransactionId,
    reversedByTransactionId: doc.reversedByTransactionId,
    sourceType: doc.sourceType,
    sourceId: doc.sourceId,
    entries: entries.map(toJournalEntry),
  };
}
