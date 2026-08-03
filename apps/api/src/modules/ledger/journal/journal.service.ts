import type { CursorPage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { buildCursorPage } from '../../../common/pagination/cursor.js';
import { LedgerEntryDoc, LedgerTransactionDoc } from '../infrastructure/ledger.schemas.js';
import { buildEntryScope, buildTransactionFilter } from './journal.filter.js';
import { toJournalTransaction } from './journal.mapper.js';
import type { JournalQuery } from './journal.schemas.js';
import type { JournalTransaction } from './journal.types.js';

/** One row past the page size is fetched; it is the `hasMore` signal and is never returned. */
const LOOKAHEAD_ROWS = 1;

/**
 * The journal: a read model over the raw double-entry record.
 *
 * It writes nothing and derives nothing — the same rows LedgerService wrote, paged and grouped.
 * Keeping the read path separate from the write path means a heavy back-office query can never
 * interfere with posting.
 */
@Injectable()
export class JournalService {
  constructor(
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
  ) {}

  /** Page transactions newest-first, each with its full set of entries. */
  async query(query: JournalQuery): Promise<CursorPage<JournalTransaction>> {
    const scopedIds = await this.scopedTransactionIds(query);
    const filter = buildTransactionFilter(query, scopedIds);

    const rows = await this.transactions
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + LOOKAHEAD_ROWS)
      .lean();

    const page = buildCursorPage(rows, query.limit, (row) => row._id);
    const entriesByTransaction = await this.entriesFor(page.items.map((row) => row._id));

    return {
      ...page,
      items: page.items.map((row) =>
        toJournalTransaction(row, entriesByTransaction.get(row._id) ?? []),
      ),
    };
  }

  /** One transaction with its entries. Staff reach this from the journal list. */
  async detail(transactionId: string): Promise<JournalTransaction> {
    const row = await this.transactions.findById(transactionId).lean();
    if (!row) {
      throw new NotFoundError('Ledger transaction', transactionId);
    }
    const entriesByTransaction = await this.entriesFor([row._id]);
    return toJournalTransaction(row, entriesByTransaction.get(row._id) ?? []);
  }

  /**
   * Resolve account/currency scoping to the set of transactions that qualify, or null when the
   * query is unscoped. Two round-trips beat a join here: the entry index does the narrowing and
   * the transaction query stays on its own indexes.
   */
  private async scopedTransactionIds(query: JournalQuery): Promise<string[] | null> {
    const scope = buildEntryScope(query);
    if (scope === null) {
      return null;
    }
    return this.entries.distinct('transactionId', scope);
  }

  /** Fetch and group the entries of one page of transactions in a single round-trip. */
  private async entriesFor(transactionIds: readonly string[]): Promise<Map<string, LedgerEntryDoc[]>> {
    if (transactionIds.length === 0) {
      return new Map();
    }
    const rows = await this.entries
      .find({ transactionId: { $in: transactionIds } })
      .sort({ sequence: 1 })
      .lean();

    const grouped = new Map<string, LedgerEntryDoc[]>();
    for (const row of rows) {
      const list = grouped.get(row.transactionId) ?? [];
      list.push(row);
      grouped.set(row.transactionId, list);
    }
    return grouped;
  }
}
