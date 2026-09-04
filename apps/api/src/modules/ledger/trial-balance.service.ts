import type { TrialBalance } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import {
  depositGlCodeFor,
  GL_SUSPENSE,
  listGlAccounts,
  type GlAccount,
} from './domain/chart-of-accounts.js';
import { LedgerEntryDoc } from './infrastructure/ledger.schemas.js';
import { toMoneyDto } from './infrastructure/money.mapper.js';
import {
  CUSTOMER_REF_PATTERN,
  CUSTOMER_REF_PREFIX_LENGTH,
  DEFAULT_BASE_CURRENCY,
  GL_REF_PATTERN,
} from './ledger.constants.js';

/** One aggregated row: total debits and credits posted against a single ledger key. */
interface Totals {
  readonly _id: string;
  readonly debit: number;
  readonly credit: number;
}

const EMPTY_TOTALS = { debit: 0, credit: 0 };

const DEBIT_CREDIT_SUMS = {
  debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$minorUnits', 0] } },
  credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$minorUnits', 0] } },
} as const;

/**
 * Trial balance — the report that proves the bank's books add up.
 *
 * Built from `ledger_entries` rather than the cached balances on purpose: if the two ever
 * disagree, this report shows the truth and LedgerIntegrityService flags the drift.
 *
 * Both halves of every posting are counted. A customer account is a liability of the bank held
 * in its own sub-ledger (`acct:…`), so its entries are folded into the deposit control account
 * its product kind rolls up to. Summing only the `gl:` half would leave one leg of every
 * customer posting out of the totals and report a balanced bank as out of balance.
 */
@Injectable()
export class TrialBalanceService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    private readonly clock: ClockService,
  ) {}

  async generate(currency: CurrencyCode = DEFAULT_BASE_CURRENCY): Promise<TrialBalance> {
    const [glRows, subLedgerRows] = await Promise.all([
      this.generalLedgerTotals(currency),
      this.subLedgerTotals(currency),
    ]);

    const byCode = new Map<string, { debit: number; credit: number }>();
    for (const row of [...glRows, ...subLedgerRows]) {
      const current = byCode.get(row._id) ?? EMPTY_TOTALS;
      byCode.set(row._id, {
        debit: current.debit + row.debit,
        credit: current.credit + row.credit,
      });
    }

    let totalDebits = 0;
    let totalCredits = 0;
    const lines = listGlAccounts().map((account) => {
      const totals = byCode.get(account.code) ?? EMPTY_TOTALS;
      totalDebits += totals.debit;
      totalCredits += totals.credit;
      return toTrialBalanceLine(account, totals, currency);
    });

    return {
      asOf: this.clock.now().toISOString(),
      currency,
      lines,
      totalDebits: toMoneyDto(totalDebits, currency),
      totalCredits: toMoneyDto(totalCredits, currency),
      balanced: totalDebits === totalCredits,
    };
  }

  /** Postings against the bank's own accounts, keyed by their GL code. */
  private async generalLedgerTotals(currency: CurrencyCode): Promise<Totals[]> {
    const rows = await this.entries.aggregate<Totals>([
      { $match: { accountRef: { $regex: GL_REF_PATTERN }, currency } },
      { $group: { _id: '$accountRef', ...DEBIT_CREDIT_SUMS } },
    ]);
    return rows.map((row) => ({ ...row, _id: row._id.slice('gl:'.length) }));
  }

  /**
   * Customer postings, rolled up to the deposit (or loan) control account their product kind
   * maps to.
   *
   * An entry whose account has since disappeared lands in suspense rather than being dropped:
   * losing it would silently unbalance the report, while suspense is the one account the
   * integrity check requires to be zero, so an orphan is impossible to miss.
   */
  private async subLedgerTotals(currency: CurrencyCode): Promise<Totals[]> {
    const rows = await this.entries.aggregate<Totals>([
      { $match: { accountRef: { $regex: CUSTOMER_REF_PATTERN }, currency } },
      {
        $addFields: {
          accountId: {
            $substrCP: ['$accountRef', CUSTOMER_REF_PREFIX_LENGTH, { $strLenCP: '$accountRef' }],
          },
        },
      },
      {
        $lookup: {
          from: 'accounts',
          localField: 'accountId',
          foreignField: '_id',
          as: 'account',
        },
      },
      { $unwind: { path: '$account', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$account.kind', ...DEBIT_CREDIT_SUMS } },
    ]);

    return rows.map((row) => ({
      ...row,
      _id: row._id === null || row._id === undefined ? GL_SUSPENSE : depositGlCodeFor(row._id),
    }));
  }
}

/** One trial-balance row, with the balance taken in the account's natural direction. */
function toTrialBalanceLine(
  account: GlAccount,
  totals: { debit: number; credit: number },
  currency: CurrencyCode,
): TrialBalance['lines'][number] {
  const balance =
    account.normalSide === 'debit' ? totals.debit - totals.credit : totals.credit - totals.debit;
  return {
    accountCode: account.code,
    accountName: account.name,
    type: account.type,
    debit: toMoneyDto(totals.debit, currency),
    credit: toMoneyDto(totals.credit, currency),
    balance: toMoneyDto(balance, currency),
  };
}
