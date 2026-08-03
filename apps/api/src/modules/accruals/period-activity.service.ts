import type { CurrencyCode } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import { customerRef } from '../ledger/domain/account-ref.js';
import { AccountBalanceDoc, LedgerEntryDoc } from '../ledger/infrastructure/ledger.schemas.js';
import { ACTIVE_LOAN_STATUSES, CHARGEABLE_DEBIT_TYPES } from './accruals.constants.js';

/** An inclusive-exclusive statement cycle of ledger value dates. */
export interface StatementCycleRange {
  readonly fromExclusive: string;
  readonly toInclusive: string;
}

/** What the balance cache says a fee debit could actually take. */
export interface BalanceContext {
  readonly ledgerMinorUnits: number;
  readonly availableMinorUnits: number;
}

interface ScheduleRow {
  readonly dueOn: string;
  readonly instalmentMinorUnits: number;
  readonly paidMinorUnits: number;
}

interface LoanRow {
  readonly _id: string;
  readonly repaymentAccountId: string;
  readonly status: string;
  readonly schedule?: readonly ScheduleRow[];
}

/**
 * Measurements the periodic fee assessment is priced from.
 *
 * Everything here is a read over the books as they stand — ledger entries for activity, the
 * balance cache for affordability, the loans collection for arrears. Loans are read through
 * the raw collection, not the loans module's model: the batch depends on the documented shape
 * of the schedule (agent_plan.md §5) and nothing else, so a refactor next door cannot break
 * the nightly run.
 */
@Injectable()
export class PeriodActivityService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Customer debits in the cycle that count against the free transaction allowance. */
  async chargeableDebitCount(accountId: string, cycle: StatementCycleRange): Promise<number> {
    return this.entries.countDocuments({
      accountRef: customerRef(accountId),
      direction: 'debit',
      transactionType: { $in: [...CHARGEABLE_DEBIT_TYPES] },
      valueDate: { $gt: cycle.fromExclusive, $lte: cycle.toInclusive },
    });
  }

  /** Total converted volume in the cycle — the base the FX service fee is a percentage of. */
  async fxVolumeMinorUnits(accountId: string, cycle: StatementCycleRange): Promise<number> {
    const rows = await this.entries
      .aggregate<{ total: number }>([
        {
          $match: {
            accountRef: customerRef(accountId),
            direction: 'debit',
            transactionType: 'fx_conversion',
            valueDate: { $gt: cycle.fromExclusive, $lte: cycle.toInclusive },
          },
        },
        { $group: { _id: null, total: { $sum: '$minorUnits' } } },
      ])
      .exec();
    return rows[0]?.total ?? 0;
  }

  /** Instalments past due across the loans serviced from this account. */
  async overdueInstalmentCount(accountId: string, businessDate: string): Promise<number> {
    const loans = await this.connection
      .collection<LoanRow>('loans')
      .find({ repaymentAccountId: accountId, status: { $in: [...ACTIVE_LOAN_STATUSES] } })
      .toArray();

    let overdue = 0;
    for (const loan of loans) {
      for (const row of loan.schedule ?? []) {
        if (row.dueOn < businessDate && row.paidMinorUnits < row.instalmentMinorUnits) {
          overdue += 1;
        }
      }
    }
    return overdue;
  }

  /** Ledger balance and what a fee debit could take (ledger less holds plus arranged limit). */
  async balanceContext(accountId: string, currency: CurrencyCode): Promise<BalanceContext> {
    const row = await this.balances
      .findOne({ accountRef: customerRef(accountId), currency })
      .lean();
    const ledger = row?.ledgerMinorUnits ?? 0;
    return {
      ledgerMinorUnits: ledger,
      availableMinorUnits: ledger - (row?.holdMinorUnits ?? 0) + (row?.overdraftMinorUnits ?? 0),
    };
  }
}
