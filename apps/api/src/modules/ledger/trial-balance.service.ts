import type { TrialBalance } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { listGlAccounts, type GlAccount } from './domain/chart-of-accounts.js';
import { LedgerEntryDoc } from './infrastructure/ledger.schemas.js';
import { toMoneyDto } from './infrastructure/money.mapper.js';
import { DEFAULT_BASE_CURRENCY, GL_REF_PATTERN } from './ledger.constants.js';

/** One aggregated row: total debits and credits posted against a single GL account. */
interface GlTotals {
  readonly _id: string;
  readonly debit: number;
  readonly credit: number;
}

const EMPTY_TOTALS: GlTotals = { _id: '', debit: 0, credit: 0 };

const DEBIT_CREDIT_TOTALS_GROUP = {
  _id: '$accountRef',
  debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$minorUnits', 0] } },
  credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$minorUnits', 0] } },
} as const;

/**
 * Trial balance — the report that proves the bank's books add up.
 *
 * Built from `ledger_entries` rather than the cached balances on purpose: if the two ever
 * disagree, this report shows the truth and LedgerIntegrityService flags the drift.
 *
 * This is the canonical home of the report (BE-09); the admin module still carries a copy that
 * it should replace with this service.
 */
@Injectable()
export class TrialBalanceService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    private readonly clock: ClockService,
  ) {}

  async generate(currency: CurrencyCode = DEFAULT_BASE_CURRENCY): Promise<TrialBalance> {
    const rows = await this.entries.aggregate<GlTotals>([
      { $match: { accountRef: { $regex: GL_REF_PATTERN }, currency } },
      { $group: DEBIT_CREDIT_TOTALS_GROUP },
    ]);

    const totalsByRef = new Map(rows.map((row) => [row._id, row]));
    let totalDebits = 0;
    let totalCredits = 0;

    const lines = listGlAccounts().map((account) => {
      const totals = totalsByRef.get(`gl:${account.code}`) ?? EMPTY_TOTALS;
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
}

/** One trial-balance row, with the balance taken in the account's natural direction. */
function toTrialBalanceLine(
  account: GlAccount,
  totals: GlTotals,
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
