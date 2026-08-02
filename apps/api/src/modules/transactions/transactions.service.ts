import type {
  CursorPage,
  EntryDirection,
  TransactionCategory,
  TransactionDetail,
  TransactionQuery,
  TransactionStatus,
  TransactionSummary,
  TransactionType,
  Posting,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { toMoneyDto } from '../accounts/infrastructure/account.mapper.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import {
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../ledger/infrastructure/ledger.schemas.js';
import { categoriseTransaction } from './domain/categoriser.js';

/**
 * Mongoose has renamed its exported filter type across majors, so the query is assembled as a
 * plain record and handed to `find` at the call site. Keeping it structural rather than importing
 * a moving type means this file survives the next rename.
 */
type EntryFilter = Record<string, unknown>;

const SETTLED_STATUSES = ['posted', 'settled'] as const;

/**
 * Fields the enrichment modules (fees, FX, notes, attachments) will populate once built. Held in
 * one place so their absence is explicit rather than scattered nulls.
 */
const EMPTY_ENRICHMENT = {
  fees: [],
  fx: null,
  note: null,
  tags: [],
  attachmentCount: 0,
};

/** One filter clause per supported query parameter. Undefined means "not filtering on this". */
const FILTER_CLAUSES: readonly {
  field: string;
  build: (query: TransactionQuery) => unknown;
}[] = [
  { field: '_id', build: (q) => (q.cursor ? { $lt: q.cursor } : undefined) },
  { field: 'direction', build: (q) => q.direction },
  { field: 'transactionType', build: (q) => (q.type?.length ? { $in: q.type } : undefined) },
  { field: 'transactionStatus', build: (q) => (q.status?.length ? { $in: q.status } : undefined) },
  { field: 'currency', build: (q) => q.currency },
  {
    field: 'valueDate',
    build: (q) =>
      q.from || q.to
        ? { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) }
        : undefined,
  },
  {
    field: 'minorUnits',
    build: (q) =>
      q.minMinorUnits !== undefined || q.maxMinorUnits !== undefined
        ? {
            ...(q.minMinorUnits !== undefined ? { $gte: q.minMinorUnits } : {}),
            ...(q.maxMinorUnits !== undefined ? { $lte: q.maxMinorUnits } : {}),
          }
        : undefined,
  },
  { field: 'narrative', build: (q) => (q.q ? { $regex: escapeRegex(q.q), $options: 'i' } : undefined) },
];

/**
 * The customer-facing view of the ledger.
 *
 * A ledger entry is a posting against one account; a "transaction" on a statement is that
 * posting seen from the account's own point of view — which is why direction, running balance,
 * and counterparty are all resolved relative to the account being viewed rather than stored
 * once globally.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
  ) {}

  async list(customerId: string, query: TransactionQuery): Promise<CursorPage<TransactionSummary>> {
    const refs = await this.customerAccountRefs(customerId, query.accountId);
    if (refs.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const filter = this.buildFilter(refs, query);
    // One extra row tells us whether another page exists without a second count query.
    const rows = await this.entries
      .find(filter)
      .sort({ bookedAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    const headers = await this.loadHeaders(page.map((row) => row.transactionId));
    const items = page.map((row) => this.toSummary(row, headers.get(row.transactionId)));

    return {
      items,
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }

  async detail(customerId: string, transactionId: string): Promise<TransactionDetail> {
    const refs = await this.customerAccountRefs(customerId);
    const entry = await this.entries
      .findOne({ transactionId, accountRef: { $in: refs } })
      .lean();

    if (!entry) {
      throw new NotFoundError('Transaction', transactionId);
    }

    const header = await this.transactions.findById(transactionId).lean();
    const allEntries = await this.entries.find({ transactionId }).sort({ sequence: 1 }).lean();

    return {
      ...this.toSummary(entry, header ?? undefined),
      postings: allEntries.map(toPosting),
      ...EMPTY_ENRICHMENT,
      ...linkedRecords(header),
    };
  }

  /** Total money in and out over a period, used by the insights screen. */
  async cashflow(
    customerId: string,
    from: string,
    to: string,
  ): Promise<{ incomeMinorUnits: number; expenseMinorUnits: number; currency: string }> {
    const refs = await this.customerAccountRefs(customerId);
    const rows = await this.entries.aggregate<{ _id: EntryDirection; total: number; currency: string }>([
      {
        $match: {
          accountRef: { $in: refs },
          valueDate: { $gte: from, $lte: to },
          transactionStatus: { $in: ['posted', 'settled'] },
        },
      },
      { $group: { _id: '$direction', total: { $sum: '$minorUnits' }, currency: { $first: '$currency' } } },
    ]);

    const credit = rows.find((row) => row._id === 'credit');
    const debit = rows.find((row) => row._id === 'debit');

    return {
      incomeMinorUnits: credit?.total ?? 0,
      expenseMinorUnits: debit?.total ?? 0,
      currency: credit?.currency ?? debit?.currency ?? 'USD',
    };
  }

  private buildFilter(refs: string[], query: TransactionQuery): EntryFilter {
    const filter: EntryFilter = { accountRef: { $in: refs } };

    for (const clause of FILTER_CLAUSES) {
      const value = clause.build(query);
      if (value !== undefined) {
        filter[clause.field] = value;
      }
    }

    // Applied last so it overrides an explicit status filter when pending rows are excluded.
    if (!query.includePending) {
      filter['transactionStatus'] = { $in: SETTLED_STATUSES };
    }

    return filter;
  }

  private async customerAccountRefs(customerId: string, accountId?: string): Promise<string[]> {
    const filter = accountId ? { customerId, _id: accountId } : { customerId };
    const accounts = await this.accounts.find(filter).select('_id').lean();
    return accounts.map((account) => customerRef(account._id));
  }

  private async loadHeaders(ids: string[]): Promise<Map<string, LedgerTransactionDoc>> {
    const headers = await this.transactions.find({ _id: { $in: ids } }).lean();
    return new Map(headers.map((header) => [header._id, header]));
  }

  private toSummary(
    entry: LedgerEntryDoc,
    header: LedgerTransactionDoc | undefined,
  ): TransactionSummary {
    const description = entry.narrative ?? header?.description ?? 'Transaction';
    const category: TransactionCategory = categoriseTransaction(
      entry.transactionType,
      description,
      entry.direction,
    );

    return {
      id: entry.transactionId,
      accountId: entry.accountRef.slice('acct:'.length),
      reference: header?.reference ?? entry.transactionId,
      type: entry.transactionType as TransactionType,
      status: entry.transactionStatus as TransactionStatus,
      direction: entry.direction,
      amount: toMoneyDto(entry.minorUnits, entry.currency),
      runningBalance: null,
      description,
      category,
      merchant: null,
      counterparty: null,
      bookedAt: entry.bookedAt.toISOString(),
      valueDate: entry.valueDate,
      pending: entry.transactionStatus !== 'posted' && entry.transactionStatus !== 'settled',
    };
  }
}

/** User-supplied search text goes into a regex, so metacharacters must be neutralised. */
function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A ledger entry as one line of the customer-facing posting breakdown. */
function toPosting(posting: LedgerEntryDoc): Posting {
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
function linkedRecords(header: LedgerTransactionDoc | null) {
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
