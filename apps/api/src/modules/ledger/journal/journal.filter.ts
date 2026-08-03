import type { QueryFilter } from 'mongoose';

import { decodeCursor } from '../../../common/pagination/cursor.js';
import type { LedgerEntryDoc, LedgerTransactionDoc } from '../infrastructure/ledger.schemas.js';
import type { JournalQuery } from './journal.schemas.js';

/**
 * Translate a journal query into Mongoose filters. Pure so the translation is testable without
 * a database in sight.
 *
 * `_id` is a ULID, so it sorts by creation time; the cursor is simply "ids before this one",
 * which keeps pagination stable even while new postings arrive mid-scroll.
 */
export function buildTransactionFilter(
  query: JournalQuery,
  scopedIds: readonly string[] | null,
): QueryFilter<LedgerTransactionDoc> {
  const filter: QueryFilter<LedgerTransactionDoc> = {};

  const idFilter = buildIdFilter(query.cursor, scopedIds);
  if (idFilter !== null) {
    filter._id = idFilter;
  }

  if (query.reference) {
    filter.reference = query.reference;
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.status) {
    filter.status = query.status;
  }

  const valueDate = buildValueDateFilter(query.from, query.to);
  if (valueDate !== null) {
    filter.valueDate = valueDate;
  }

  return filter;
}

/** The entry-side pre-filter: which transactions touched this account or currency at all. */
export function buildEntryScope(query: JournalQuery): QueryFilter<LedgerEntryDoc> | null {
  const scope: QueryFilter<LedgerEntryDoc> = {};
  if (query.accountRef) {
    scope.accountRef = query.accountRef;
  }
  if (query.currency) {
    scope.currency = query.currency;
  }
  return Object.keys(scope).length === 0 ? null : scope;
}

interface IdFilter {
  $lt?: string;
  $in?: readonly string[];
}

function buildIdFilter(
  cursor: string | undefined,
  scopedIds: readonly string[] | null,
): IdFilter | null {
  const idFilter: IdFilter = {};
  if (cursor) {
    idFilter.$lt = decodeCursor(cursor);
  }
  if (scopedIds !== null) {
    idFilter.$in = scopedIds;
  }
  return idFilter.$lt !== undefined || idFilter.$in !== undefined ? idFilter : null;
}

interface ValueDateFilter {
  $gte?: string;
  $lte?: string;
}

function buildValueDateFilter(from: string | undefined, to: string | undefined): ValueDateFilter | null {
  const range: ValueDateFilter = {};
  if (from) {
    range.$gte = from;
  }
  if (to) {
    range.$lte = to;
  }
  return range.$gte !== undefined || range.$lte !== undefined ? range : null;
}
