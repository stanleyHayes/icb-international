import type {
  CursorPage,
  TransactionDetail,
  TransactionQuery,
  TransactionSummary,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import {
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../ledger/infrastructure/ledger.schemas.js';
import { TransactionAnnotationsService } from './annotations.service.js';
import {
  baselinesFromSums,
  computeRunningBalances,
  type RunningBalanceEntry,
} from './domain/running-balance.js';
import { buildEntryFilter, newerThanClause, type EntryFilter } from './domain/transaction-filters.js';
import { toDetail, toSummary } from './infrastructure/transaction.mapper.js';
import { SETTLED_STATUSES } from './transactions.constants.js';

interface SettledSum {
  accountRef: string;
  currency: string;
  sum: number;
}

/**
 * The customer-facing view of the ledger.
 *
 * A ledger entry is a posting against one account; a "transaction" on a statement is that
 * posting seen from the account's own point of view — which is why direction, running balance,
 * and merchant are all resolved relative to the account being viewed rather than stored once
 * globally. Balances are always derived from entries (agent_plan.md N4), here with two
 * aggregations per page — never one query per row.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly annotations: TransactionAnnotationsService,
  ) {}

  async list(customerId: string, query: TransactionQuery): Promise<CursorPage<TransactionSummary>> {
    const refs = await this.customerAccountRefs(customerId, query.accountId);
    if (refs.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const rows = await this.entries
      .find(buildEntryFilter(refs, query))
      .sort({ bookedAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean();

    // One extra row tells us whether another page exists without a second count query.
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const transactionIds = page.map((row) => row.transactionId);

    const [headers, balances, annotations] = await Promise.all([
      this.loadHeaders(transactionIds),
      this.runningBalancesFor(page),
      this.annotations.getForTransactions(customerId, transactionIds),
    ]);

    const items = page.map((row) =>
      toSummary(row, headers.get(row.transactionId), {
        runningMinorUnits: balances.get(row._id) ?? null,
        categoryOverride: annotations.get(row.transactionId)?.category ?? null,
      }),
    );

    return {
      items,
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }

  async detail(customerId: string, transactionId: string): Promise<TransactionDetail> {
    const entry = await this.requireEntry(customerId, transactionId);

    const [header, allEntries, annotation, balances] = await Promise.all([
      this.transactions.findById(transactionId).lean(),
      this.entries.find({ transactionId }).sort({ sequence: 1 }).lean(),
      this.annotations.getForTransaction(customerId, transactionId),
      this.runningBalancesFor([entry]),
    ]);

    return toDetail(entry, {
      header: header ?? null,
      entries: allEntries,
      annotation,
      runningMinorUnits: balances.get(entry._id) ?? null,
    });
  }

  /** Notes/tags/category writes. The transaction must be one of the customer's own first. */
  async annotate(
    customerId: string,
    transactionId: string,
    patch: Parameters<TransactionAnnotationsService['upsert']>[2],
  ): Promise<TransactionDetail> {
    await this.requireEntry(customerId, transactionId);
    await this.annotations.upsert(customerId, transactionId, patch);
    return this.detail(customerId, transactionId);
  }

  /** The entry for this transaction on one of the customer's accounts, or a 404. */
  private async requireEntry(customerId: string, transactionId: string): Promise<LedgerEntryDoc> {
    const refs = await this.customerAccountRefs(customerId);
    const entry = await this.entries
      .findOne({ transactionId, accountRef: { $in: refs } })
      .lean();

    if (!entry) {
      throw new NotFoundError('Transaction', transactionId);
    }
    return entry;
  }

  /**
   * Running balance after each entry of the page, keyed by entry id. Two aggregations cover
   * the whole page: the settled total per account+currency, and the part of it newer than the
   * page. Their difference is the baseline the in-page walk subtracts from.
   */
  private async runningBalancesFor(page: LedgerEntryDoc[]): Promise<Map<string, number | null>> {
    const newest = page[0];
    if (!newest) {
      return new Map();
    }

    const refs = [...new Set(page.map((row) => row.accountRef))];
    const [totals, newer] = await Promise.all([
      this.settledSums(refs, {}),
      this.settledSums(refs, newerThanClause(newest.bookedAt, newest._id)),
    ]);

    const computed = computeRunningBalances(
      page.map(toRunningBalanceEntry),
      baselinesFromSums(totals, newer),
    );
    return new Map(page.map((row, index) => [row._id, computed[index] ?? null]));
  }

  private settledSums(refs: string[], extra: EntryFilter): Promise<SettledSum[]> {
    return this.entries.aggregate<SettledSum>([
      {
        $match: {
          accountRef: { $in: refs },
          transactionStatus: { $in: SETTLED_STATUSES },
          ...extra,
        },
      },
      {
        $group: {
          _id: { ref: '$accountRef', cur: '$currency' },
          sum: { $sum: '$signedMinorUnits' },
        },
      },
      { $project: { _id: 0, accountRef: '$_id.ref', currency: '$_id.cur', sum: 1 } },
    ]);
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
}

function toRunningBalanceEntry(entry: LedgerEntryDoc): RunningBalanceEntry {
  return {
    accountRef: entry.accountRef,
    currency: entry.currency,
    signedMinorUnits: entry.signedMinorUnits,
    settled: (SETTLED_STATUSES as readonly string[]).includes(entry.transactionStatus),
  };
}
