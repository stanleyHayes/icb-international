import { fromMinorUnits, isCurrencyCode, type CurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { InterestAccrualDoc } from '../../simulation/eod/infrastructure/eod.schemas.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import { GL_INTEREST_EXPENSE } from '../ledger/domain/chart-of-accounts.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { SYSTEM_ACTOR } from './accruals.constants.js';
import { policyFor } from './domain/accrual-policy.js';
import { isCapitalisationDate } from './domain/capitalisation.js';

export interface CapitalisationSummary {
  readonly accountsCapitalised: number;
  readonly minorUnitsByCurrency: Record<string, number>;
}

/**
 * Capitalisation: accrued interest becomes the customer's money.
 *
 * On an account's capitalisation date every unposted accrual row is summed and posted in one
 * transaction — interest expense (GL 5000) down, customer liability up — and the rows are
 * marked with the posting's id. From that posting the interest is part of the ledger balance,
 * so the next day's accrual compounds on it.
 *
 * Re-runnable by construction: a second run for the same date finds the rows already marked
 * and posts nothing. The re-read happens inside the posting session, so a concurrent run
 * either sees the rows unmarked and loses the write conflict, or sees them marked and stops.
 */
@Injectable()
export class CapitalisationService {
  private readonly logger = new Logger(CapitalisationService.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(InterestAccrualDoc.name) private readonly accruals: Model<InterestAccrualDoc>,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async run(businessDate: string, _asOf: Date): Promise<CapitalisationSummary> {
    const candidates = await this.accounts.find({ status: 'active' }).sort({ _id: 1 }).lean();

    let capitalised = 0;
    const totals: Record<string, number> = {};
    for (const account of candidates) {
      const amount = await this.capitaliseOne(account, businessDate);
      if (amount !== null && amount > 0) {
        capitalised += 1;
        totals[account.currency] = (totals[account.currency] ?? 0) + amount;
      }
    }

    if (capitalised > 0) {
      this.logger.log({ businessDate, accountsCapitalised: capitalised, totals }, 'Interest capitalised');
    }
    return { accountsCapitalised: capitalised, minorUnitsByCurrency: totals };
  }

  /** Post the unposted accruals of one account, when today is its capitalisation date. */
  private async capitaliseOne(account: AccountDoc, businessDate: string): Promise<number | null> {
    if (!isCurrencyCode(account.currency)) {
      return null;
    }
    const policy = policyFor(account.kind, account.currency, account.interestRate);
    if (policy === null || !isCapitalisationDate(businessDate, policy.capitalisation, account.statementDay)) {
      return null;
    }

    return this.transactionManager.withTransaction(async (session) => {
      const rows = await this.accruals
        .find({ accountId: account._id, postedTransactionId: null })
        .sort({ accrualDate: 1 })
        .session(session)
        .lean();
      if (rows.length === 0) {
        return null;
      }
      const total = rows.reduce((sum, row) => sum + row.minorUnits, 0);
      if (total > 0) {
        const transactionId = await this.postCapitalisation(account, total, businessDate, session);
        await this.accruals.updateMany(
          { _id: { $in: rows.map((row) => row._id) } },
          { $set: { postedTransactionId: transactionId } },
          { session },
        );
      }
      return total;
    });
  }

  /** Interest expense up, customer liability up, valued on the capitalisation date. */
  private async postCapitalisation(
    account: AccountDoc,
    totalMinorUnits: number,
    businessDate: string,
    session: ClientSession,
  ): Promise<string> {
    const amount = fromMinorUnits(totalMinorUnits, account.currency as CurrencyCode);
    const posted = await this.ledger.postWithin(
      {
        type: 'interest',
        description: `Interest capitalised — ${businessDate}`,
        actor: SYSTEM_ACTOR,
        valueDate: businessDate,
        sourceType: 'interest_capitalisation',
        sourceId: account._id,
        lines: [
          {
            accountRef: glRef(GL_INTEREST_EXPENSE),
            direction: 'debit',
            amount,
            narrative: 'Interest capitalised',
          },
          {
            accountRef: customerRef(account._id),
            direction: 'credit',
            amount,
            narrative: 'Interest earned',
          },
        ],
      },
      session,
    );
    return posted.id;
  }
}
