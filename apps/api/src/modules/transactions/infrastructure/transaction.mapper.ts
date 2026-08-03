import type {
  Posting,
  TransactionCategory,
  TransactionDetail,
  TransactionStatus,
  TransactionSummary,
  TransactionType,
} from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type {
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../ledger/infrastructure/ledger.schemas.js';
import { categoriseTransaction } from '../domain/categoriser.js';
import { enrichMerchant } from '../domain/merchant-enrichment.js';
import type { TransactionAnnotationDoc } from './transaction-annotation.schemas.js';

/** Per-entry extras resolved by the service: balance math and the customer's own overrides. */
export interface SummaryExtras {
  /** Balance after this entry; null while the entry is still in flight. */
  readonly runningMinorUnits: number | null;
  /** A category the customer set by hand. Wins over the categoriser when present. */
  readonly categoryOverride: string | null;
}

/** Everything a detail render needs beyond the entry itself, resolved once by the service. */
export interface DetailParts {
  readonly header: LedgerTransactionDoc | null;
  readonly entries: readonly LedgerEntryDoc[];
  readonly annotation: TransactionAnnotationDoc | null;
  readonly runningMinorUnits: number | null;
}

/** The cross-reference tail of a transaction detail. */
interface LinkedRecords {
  readonly relatedTransferId: string | null;
  readonly relatedCardId: string | null;
  readonly reversalOfId: string | null;
  readonly reversedById: string | null;
  readonly disputeId: string | null;
  readonly metadata: Record<string, string> | undefined;
  readonly settledAt: string | null;
}

/**
 * Maps one ledger entry to the customer-facing summary. Direction, running balance, and
 * merchant are all resolved relative to the account the entry was posted to — the same ledger
 * transaction is a debit on one statement and a credit on another.
 */
export function toSummary(
  entry: LedgerEntryDoc,
  header: LedgerTransactionDoc | undefined,
  extras: SummaryExtras,
): TransactionSummary {
  const description = entry.narrative ?? header?.description ?? 'Transaction';
  const category: TransactionCategory =
    (extras.categoryOverride as TransactionCategory | null) ??
    categoriseTransaction(entry.transactionType, description, entry.direction);

  return {
    id: entry.transactionId,
    accountId: entry.accountRef.slice('acct:'.length),
    reference: header?.reference ?? entry.transactionId,
    type: entry.transactionType as TransactionType,
    status: entry.transactionStatus as TransactionStatus,
    direction: entry.direction,
    amount: toMoneyDto(entry.minorUnits, entry.currency),
    runningBalance:
      extras.runningMinorUnits === null
        ? null
        : toMoneyDto(extras.runningMinorUnits, entry.currency),
    description,
    category,
    merchant: enrichMerchant(description, entry.transactionType, category),
    counterparty: null,
    bookedAt: entry.bookedAt.toISOString(),
    valueDate: entry.valueDate,
    pending: entry.transactionStatus !== 'posted' && entry.transactionStatus !== 'settled',
  };
}

/** The full detail: summary plus postings, annotation layer, and cross-references. */
export function toDetail(entry: LedgerEntryDoc, parts: DetailParts): TransactionDetail {
  return {
    ...toSummary(entry, parts.header ?? undefined, {
      runningMinorUnits: parts.runningMinorUnits,
      categoryOverride: parts.annotation?.category ?? null,
    }),
    postings: parts.entries.map(toPosting),
    // Fees and FX legs are enriched by their own modules (BE-18 / BE-14); empty until then.
    fees: [],
    fx: null,
    note: parts.annotation?.note ?? null,
    tags: parts.annotation?.tags ?? [],
    attachmentCount: parts.annotation?.attachments.length ?? 0,
    ...linkedRecords(parts.header),
  };
}

/** A ledger entry as one line of the customer-facing posting breakdown. */
export function toPosting(posting: LedgerEntryDoc): Posting {
  return {
    id: posting._id,
    accountLabel: posting.accountRef,
    direction: posting.direction,
    amount: toMoneyDto(posting.minorUnits, posting.currency),
    valueDate: posting.valueDate,
    sequence: posting.sequence,
  };
}

/** The originating record id, but only when it came from the expected kind of source. */
function sourceIdFor(header: LedgerTransactionDoc | null, kind: string): string | null {
  return header?.sourceType === kind ? (header.sourceId ?? null) : null;
}

/** Cross-references from a transaction to the records that caused or amended it. */
function linkedRecords(header: LedgerTransactionDoc | null): LinkedRecords {
  return {
    relatedTransferId: sourceIdFor(header, 'transfer'),
    relatedCardId: sourceIdFor(header, 'card'),
    reversalOfId: header?.reversesTransactionId ?? null,
    reversedById: header?.reversedByTransactionId ?? null,
    disputeId: null,
    metadata: header?.metadata,
    settledAt: header?.settledAt?.toISOString() ?? null,
  };
}
