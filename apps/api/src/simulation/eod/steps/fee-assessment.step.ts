import { fromMinorUnits, isGreaterThan, subtract, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { isDuplicateKeyError } from '../../../infrastructure/database/mongo-errors.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import { customerRef, glRef } from '../../../modules/ledger/domain/account-ref.js';
import { GL_FEE_INCOME } from '../../../modules/ledger/domain/chart-of-accounts.js';
import { AccountBalanceDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import { LedgerService } from '../../../modules/ledger/ledger.service.js';
import { CurrencyTotals, periodOf, type EodContext } from '../eod.context.js';
import { FeeChargeDoc } from '../infrastructure/eod.schemas.js';

/** The one fee the batch assesses. Transaction and FX fees are charged at the point of use. */
const MAINTENANCE_FEE_CODE = 'ACCOUNT_MAINTENANCE';

/**
 * Step 4 — assess fees.
 *
 * The monthly maintenance fee, taken on each account's own statement day rather than on the first
 * of the month, so the charge lands with the statement the customer is about to receive.
 *
 * A fee that would overdraw an unarranged account is *recorded as waived*, not forced. Pushing an
 * account into unauthorised overdraft to collect five units is how banks generate complaints, and
 * it would break the ledger invariant that no account goes negative without a limit.
 */
@Injectable()
export class FeeAssessmentStep {
  private readonly logger = new Logger(FeeAssessmentStep.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @InjectModel(FeeChargeDoc.name) private readonly charges: Model<FeeChargeDoc>,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async run(context: EodContext): Promise<CurrencyTotals> {
    const dayOfMonth = Number(context.businessDate.slice(8, 10));

    const due = await this.accounts
      .find({
        status: 'active',
        statementDay: dayOfMonth,
        monthlyFeeMinorUnits: { $gt: 0 },
      })
      .sort({ _id: 1 })
      .lean();

    const totals = new CurrencyTotals();
    for (const account of due) {
      const charged = await this.assessOne(account, context);
      if (charged) {
        totals.add(charged);
      }
    }

    if (due.length > 0) {
      this.logger.log(
        { businessDate: context.businessDate, considered: due.length, totals: totals.breakdown() },
        'Fees assessed',
      );
    }
    return totals;
  }

  private async assessOne(account: AccountDoc, context: EodContext): Promise<Money | null> {
    const currency = account.currency as CurrencyCode;
    const fee = fromMinorUnits(account.monthlyFeeMinorUnits ?? 0, currency);

    if (fee.minorUnits <= 0) {
      return null;
    }

    const affordable = !isGreaterThan(fee, await this.availableBalance(account._id, currency));

    try {
      await this.transactionManager.withTransaction((session) =>
        this.claimAndPost({ account, fee, context, affordable }, session),
      );
      return affordable ? fee : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * The charge row is written whether or not the money could be taken. A waiver the bank cannot
   * see is a waiver it cannot explain to a customer or count in its income.
   */
  private async claimAndPost(input: FeeInput, session: ClientSession): Promise<void> {
    const chargeId = newId();
    const period = periodOf(input.context.businessDate);

    await this.charges.create(
      [
        {
          _id: chargeId,
          accountId: input.account._id,
          period,
          code: MAINTENANCE_FEE_CODE,
          minorUnits: input.fee.minorUnits,
          currency: input.fee.currency,
          postedTransactionId: null,
          waivedReason: input.affordable ? null : 'Insufficient available balance',
          createdAt: input.context.asOf,
        },
      ],
      { session, ordered: true },
    );

    if (!input.affordable) {
      return;
    }

    const posted = await this.ledger.postWithin(
      {
        type: 'fee',
        description: `Account maintenance fee — ${period}`,
        actor: { kind: 'system', id: null, label: 'end-of-day' },
        valueDate: input.context.businessDate,
        sourceType: 'fee_charge',
        sourceId: chargeId,
        lines: [
          {
            accountRef: customerRef(input.account._id),
            direction: 'debit',
            amount: input.fee,
            narrative: 'Monthly maintenance fee',
          },
          {
            accountRef: glRef(GL_FEE_INCOME),
            direction: 'credit',
            amount: input.fee,
            narrative: MAINTENANCE_FEE_CODE,
          },
        ],
      },
      session,
    );

    await this.charges.updateOne(
      { _id: chargeId },
      { $set: { postedTransactionId: posted.id } },
      { session },
    );
  }

  /** Ledger balance less holds, plus any arranged overdraft. */
  private async availableBalance(accountId: string, currency: CurrencyCode): Promise<Money> {
    const row = await this.balances
      .findOne({ accountRef: customerRef(accountId), currency })
      .lean();

    const ledger = fromMinorUnits(row?.ledgerMinorUnits ?? 0, currency);
    const holds = fromMinorUnits(row?.holdMinorUnits ?? 0, currency);
    return fromMinorUnits(
      subtract(ledger, holds).minorUnits + (row?.overdraftMinorUnits ?? 0),
      currency,
    );
  }
}

interface FeeInput {
  readonly account: AccountDoc;
  readonly fee: Money;
  readonly context: EodContext;
  readonly affordable: boolean;
}
