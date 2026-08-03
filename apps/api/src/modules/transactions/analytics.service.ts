import type { Cashflow, SpendByCategory, TransactionCategory } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { toMoneyDto } from '../accounts/infrastructure/account.mapper.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../ledger/infrastructure/ledger.schemas.js';
import { TransactionAnnotationsService } from './annotations.service.js';
import {
  bucketSeries,
  buildCashflowPoints,
  previousWindow,
  seriesStart,
  summariseSpend,
  trailingWindow,
  type Granularity,
  type SpendRow,
} from './domain/analytics.js';
import { categoriseTransaction } from './domain/categoriser.js';
import {
  ANALYTICS_DEFAULT_PERIOD_DAYS,
  CASHFLOW_PERIOD_COUNT,
  SETTLED_STATUSES,
} from './transactions.constants.js';

export interface SpendQuery {
  currency: string;
  from?: string | undefined;
  to?: string | undefined;
}

export interface CashflowQuery {
  currency: string;
  granularity: Granularity;
}

/**
 * Spending insights over the ledger. Categories are not stored — they are derived per row by
 * the categoriser, with the customer's own annotation winning when one exists — so insights
 * can never disagree with the list the customer sees them in.
 */
@Injectable()
export class TransactionAnalyticsService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly annotations: TransactionAnnotationsService,
    private readonly clock: ClockService,
  ) {}

  /** Debit spend grouped by category over a window, diffed against the previous one. */
  async spendByCategory(customerId: string, query: SpendQuery): Promise<SpendByCategory> {
    const fallback = trailingWindow(this.clock.today(), ANALYTICS_DEFAULT_PERIOD_DAYS);
    const window = { from: query.from ?? fallback.from, to: query.to ?? fallback.to };
    const refs = await this.customerAccountRefs(customerId);

    if (refs.length === 0) {
      return this.emptySpend(query.currency, window);
    }

    const rows = await this.debitRows(refs, query.currency, previousWindow(window.from, window.to), window);
    const annotations = await this.annotations.getForTransactions(
      customerId,
      rows.map((row) => row.transactionId),
    );
    const toSpendRow = (row: LedgerEntryDoc): SpendRow => ({
      category: this.categoryFor(row, annotations.get(row.transactionId)?.category ?? null),
      minorUnits: row.minorUnits,
    });

    const categories = summariseSpend(
      rows.filter((row) => row.valueDate >= window.from).map(toSpendRow),
      rows.filter((row) => row.valueDate < window.from).map(toSpendRow),
    ).map((row) => ({
      category: row.category as TransactionCategory,
      amount: toMoneyDto(row.minorUnits, query.currency),
      share: row.share,
      transactionCount: row.transactionCount,
      changeFromPreviousPeriod: row.changeFromPreviousPeriod,
    }));

    const grandTotal = categories.reduce((sum, row) => sum + row.amount.minorUnits, 0);
    return {
      period: window,
      currency: query.currency as SpendByCategory['currency'],
      total: toMoneyDto(grandTotal, query.currency),
      categories,
    };
  }

  /** Settled debits across both the current and the previous window, in one read. */
  private async debitRows(
    refs: string[],
    currency: string,
    previous: { from: string; to: string },
    window: { from: string; to: string },
  ): Promise<LedgerEntryDoc[]> {
    return this.entries
      .find({
        accountRef: { $in: refs },
        direction: 'debit',
        currency,
        transactionStatus: { $in: SETTLED_STATUSES },
        valueDate: { $gte: previous.from, $lte: window.to },
      })
      .lean();
  }

  /** The customer's override wins; otherwise the categoriser's verdict. */
  private categoryFor(row: LedgerEntryDoc, override: string | null): string {
    return (
      override ??
      categoriseTransaction(row.transactionType, row.narrative ?? 'Transaction', row.direction)
    );
  }

  /** Income/expense buckets for the trailing CASHFLOW_PERIOD_COUNT weeks or months. */
  async cashflow(customerId: string, query: CashflowQuery): Promise<Cashflow> {
    const today = this.clock.today();
    const periods = bucketSeries(today, query.granularity, CASHFLOW_PERIOD_COUNT);
    const refs = await this.customerAccountRefs(customerId);

    const rows =
      refs.length === 0
        ? []
        : await this.entries
            .find({
              accountRef: { $in: refs },
              currency: query.currency,
              transactionStatus: { $in: SETTLED_STATUSES },
              valueDate: { $gte: seriesStart(periods, query.granularity), $lte: today },
            })
            .select('valueDate direction minorUnits')
            .lean();

    return {
      currency: query.currency as Cashflow['currency'],
      granularity: query.granularity,
      points: buildCashflowPoints(rows, periods, query.granularity).map((point) => ({
        period: point.period,
        income: toMoneyDto(point.incomeMinorUnits, query.currency),
        expense: toMoneyDto(point.expenseMinorUnits, query.currency),
        net: toMoneyDto(point.netMinorUnits, query.currency),
      })),
    };
  }

  private emptySpend(currency: string, window: { from: string; to: string }): SpendByCategory {
    return {
      period: window,
      currency: currency as SpendByCategory['currency'],
      total: toMoneyDto(0, currency),
      categories: [],
    };
  }

  private async customerAccountRefs(customerId: string): Promise<string[]> {
    const accounts = await this.accounts.find({ customerId }).select('_id').lean();
    return accounts.map((account) => customerRef(account._id));
  }
}
