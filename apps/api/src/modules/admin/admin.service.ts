import type { Kpi, MonitorEntry, TrialBalance } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { toMoneyDto } from '../accounts/infrastructure/account.mapper.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { CustomerDoc } from '../customers/infrastructure/customer.schemas.js';
import { getGlAccount, listGlAccounts } from '../ledger/domain/chart-of-accounts.js';
import {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../ledger/infrastructure/ledger.schemas.js';

const BASE_CURRENCY = 'USD';
const CUSTOMER_REF_PREFIX = '^acct:';

/** KPI constructors. Keeping the shape in one place stops five near-identical literals. */
function money(key: string, label: string, minorUnits: number, positive: Kpi['positiveDirection']): Kpi {
  return {
    key,
    label,
    value: toMoneyDto(minorUnits, BASE_CURRENCY),
    format: 'money',
    changePercent: null,
    trend: 'flat',
    positiveDirection: positive,
  };
}

function count(key: string, label: string, value: number, positive: Kpi['positiveDirection']): Kpi {
  return {
    key,
    label,
    value,
    format: 'count',
    changePercent: null,
    trend: 'flat',
    positiveDirection: positive,
  };
}

/**
 * Read-only aggregation for the back office.
 *
 * Deliberately thin: it composes what other modules already own and holds no business rules of
 * its own, so a rule can never be enforced one way for customers and another way for staff.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    private readonly clock: ClockService,
  ) {}

  async kpis(): Promise<Kpi[]> {
    const [customerCount, accountCount, transactionCount, deposits, todayVolume] =
      await Promise.all([
        this.customers.countDocuments({ status: { $ne: 'closed' } }),
        this.accounts.countDocuments({ status: { $ne: 'closed' } }),
        this.transactions.estimatedDocumentCount(),
        this.depositsUnderManagement(),
        this.volumeSince(this.clock.startOfDay()),
      ]);

    return [
      money('deposits', 'Deposits under management', deposits, 'up'),
      count('customers', 'Active customers', customerCount, 'up'),
      count('accounts', 'Open accounts', accountCount, 'up'),
      count('postings', 'Ledger transactions', transactionCount, 'neutral'),
      money('volume_today', 'Volume today', todayVolume, 'up'),
    ];
  }

  /**
   * Trial balance — the report that proves the bank's books add up.
   *
   * Built from `ledger_entries` rather than the cached balances on purpose: if the two ever
   * disagree, this report shows the truth and LedgerIntegrityService flags the drift.
   */
  async trialBalance(): Promise<TrialBalance> {
    const rows = await this.entries.aggregate<{
      _id: string;
      debit: number;
      credit: number;
    }>([
      { $match: { accountRef: { $regex: '^gl:' }, currency: BASE_CURRENCY } },
      {
        $group: {
          _id: '$accountRef',
          debit: { $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$minorUnits', 0] } },
          credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$minorUnits', 0] } },
        },
      },
    ]);

    const byRef = new Map(rows.map((row) => [row._id, row]));
    let totalDebits = 0;
    let totalCredits = 0;

    const lines = listGlAccounts().map((account) => {
      const row = byRef.get(`gl:${account.code}`) ?? { debit: 0, credit: 0 };
      totalDebits += row.debit;
      totalCredits += row.credit;
      return toTrialBalanceLine(account, row);
    });

    return {
      asOf: this.clock.now().toISOString(),
      currency: BASE_CURRENCY,
      lines,
      totalDebits: toMoneyDto(totalDebits, BASE_CURRENCY),
      totalCredits: toMoneyDto(totalCredits, BASE_CURRENCY),
      balanced: totalDebits === totalCredits,
    };
  }

  /** The global transaction monitor — every posting in the bank, newest first. */
  async monitor(limit = 40): Promise<MonitorEntry[]> {
    const rows = await this.transactions.find().sort({ bookedAt: -1 }).limit(limit).lean();
    const entries = await this.entries
      .find({ transactionId: { $in: rows.map((row) => row._id) } })
      .lean();

    const firstEntry = new Map<string, LedgerEntryDoc>();
    for (const entry of entries) {
      if (!firstEntry.has(entry.transactionId)) {
        firstEntry.set(entry.transactionId, entry);
      }
    }

    return rows.map((row) => {
      const entry = firstEntry.get(row._id);
      return {
        transactionId: row._id,
        reference: row.reference,
        at: row.bookedAt.toISOString(),
        customerId: null,
        customerName: row.actor.label,
        accountLabel: entry?.accountRef ?? '—',
        type: row.type,
        status: row.status as MonitorEntry['status'],
        direction: entry?.direction ?? 'debit',
        amount: toMoneyDto(entry?.minorUnits ?? 0, entry?.currency ?? BASE_CURRENCY),
        rail: row.sourceType,
        riskScore: null,
        flagged: false,
      };
    });
  }

  private async depositsUnderManagement(): Promise<number> {
    const rows = await this.balances
      .find({ accountRef: { $regex: CUSTOMER_REF_PREFIX }, currency: BASE_CURRENCY })
      .lean();
    return rows.reduce((total, row) => total + row.ledgerMinorUnits, 0);
  }

  private async volumeSince(since: Date): Promise<number> {
    const rows = await this.entries.aggregate<{ total: number }>([
      { $match: { bookedAt: { $gte: since }, direction: 'debit', currency: BASE_CURRENCY } },
      { $group: { _id: null, total: { $sum: '$minorUnits' } } },
    ]);
    return rows[0]?.total ?? 0;
  }

  /** Exposed so the console can label GL codes without duplicating the chart of accounts. */
  describeGlAccount(code: string): string {
    return getGlAccount(code).name;
  }
}

/** One trial-balance row, with the balance taken in the account's natural direction. */
function toTrialBalanceLine(
  account: ReturnType<typeof listGlAccounts>[number],
  row: { debit: number; credit: number },
): TrialBalance['lines'][number] {
  const balance = account.normalSide === 'debit' ? row.debit - row.credit : row.credit - row.debit;
  return {
    accountCode: account.code,
    accountName: account.name,
    type: account.type,
    debit: toMoneyDto(row.debit, BASE_CURRENCY),
    credit: toMoneyDto(row.credit, BASE_CURRENCY),
    balance: toMoneyDto(balance, BASE_CURRENCY),
  };
}
