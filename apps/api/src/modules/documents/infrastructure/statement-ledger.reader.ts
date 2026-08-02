import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type { NormalSide } from '../../ledger/domain/chart-of-accounts.js';
import {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../ledger/infrastructure/ledger.schemas.js';
import { EMPTY_TOTALS, type EntryTotals } from '../domain/statement-figures.js';
import type { StatementLine } from '../domain/statement-period.js';

/** A table row before its running balance is known. */
export type UnbalancedLine = Omit<StatementLine, 'balanceMinorUnits'>;

interface TotalsRow {
  creditMinorUnits: number;
  debitMinorUnits: number;
  signedMinorUnits: number;
  count: number;
}

const DEFAULT_DESCRIPTION = 'Transaction';

/**
 * Reads `ledger_entries` for one account, the way a statement needs them.
 *
 * No status filter is applied. Every entry that has been written affects the account's balance,
 * so excluding some of them would produce a statement whose closing figure disagreed with the
 * balance the customer sees in the app — and reversals are meant to be visible next to what they
 * reverse, not quietly removed.
 */
@Injectable()
export class StatementLedgerReader {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
  ) {}

  /**
   * The account's normal side, which decides whether a credit reads as money in. Absent a
   * balance row the account has never been posted to, and a customer account is credit-normal.
   */
  async normalSideFor(accountRef: string, currency: string): Promise<NormalSide> {
    const balance = await this.balances.findOne({ accountRef, currency }).select('normalSide').lean();
    return balance?.normalSide === 'debit' ? 'debit' : 'credit';
  }

  /** Everything posted before the period opens — the opening balance. */
  async totalsBefore(accountRef: string, currency: string, from: string): Promise<EntryTotals> {
    return this.totals({ accountRef, currency, valueDate: { $lt: from } });
  }

  async totalsWithin(
    accountRef: string,
    currency: string,
    from: string,
    to: string,
  ): Promise<EntryTotals> {
    return this.totals({ accountRef, currency, valueDate: { $gte: from, $lte: to } });
  }

  /** The period's entries in value-date order, described the way the customer will read them. */
  async linesWithin(
    accountRef: string,
    currency: string,
    from: string,
    to: string,
  ): Promise<UnbalancedLine[]> {
    const rows = await this.entries
      .find({ accountRef, currency, valueDate: { $gte: from, $lte: to } })
      .sort({ valueDate: 1, bookedAt: 1, _id: 1 })
      .lean();

    const descriptions = await this.describe(rows.map((row) => row.transactionId));

    return rows.map((row) => ({
      valueDate: row.valueDate,
      description: row.narrative ?? descriptions.get(row.transactionId) ?? DEFAULT_DESCRIPTION,
      direction: row.direction,
      minorUnits: row.minorUnits,
    }));
  }

  /**
   * Three columns summed in one pass: credits and debits from the posting directions, and the
   * signed effect the ledger recorded. Two of those are checked against the third upstream.
   */
  private async totals(match: Record<string, unknown>): Promise<EntryTotals> {
    const [row] = await this.entries.aggregate<TotalsRow>([
      { $match: match },
      {
        $group: {
          _id: null,
          creditMinorUnits: {
            $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$minorUnits', 0] },
          },
          debitMinorUnits: {
            $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$minorUnits', 0] },
          },
          signedMinorUnits: { $sum: '$signedMinorUnits' },
          count: { $sum: 1 },
        },
      },
    ]);

    return row === undefined ? EMPTY_TOTALS : { ...row };
  }

  /** Transaction headers supply a description when an entry carries no narrative of its own. */
  private async describe(transactionIds: readonly string[]): Promise<Map<string, string>> {
    if (transactionIds.length === 0) {
      return new Map();
    }
    const headers = await this.transactions
      .find({ _id: { $in: [...new Set(transactionIds)] } })
      .select('description')
      .lean();
    return new Map(headers.map((header) => [header._id, header.description]));
  }
}
