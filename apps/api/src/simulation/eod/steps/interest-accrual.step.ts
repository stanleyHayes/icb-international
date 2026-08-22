import { fromMinorUnits, multiply, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { isDuplicateKeyError } from '../../../infrastructure/database/mongo-errors.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import { customerRef, glRef } from '../../../modules/ledger/domain/account-ref.js';
import { GL_INTEREST_EXPENSE } from '../../../modules/ledger/domain/chart-of-accounts.js';
import { AccountBalanceDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import { LedgerService } from '../../../modules/ledger/ledger.service.js';
import { CurrencyTotals, type EodContext } from '../eod.context.js';
import { InterestAccrualDoc } from '../infrastructure/eod.schemas.js';
import { annualRateFraction } from '../../../modules/accounts/domain/interest-rate.js';

/** Actual days elapsed over a 365-day year — the convention retail savings is quoted on. */
const DAY_COUNT_BASIS = 'ACT/365';
const DAYS_IN_YEAR = 365;
/** Applied when a savings account carries no rate of its own. */
const FALLBACK_RATE = 0.024;

/**
 * Step 3 — accrue interest.
 *
 * One day of interest on each savings balance, debited to interest expense (GL 5000) and credited
 * to the customer, because the money is theirs the moment it is earned.
 *
 * The accrual row and the posting are written in one database transaction, and the row is guarded
 * by a unique index on `(accountId, accrualDate)`. That is the whole idempotency story: a second
 * run for the same day loses the race against the index and posts nothing. A check-then-write
 * would let two runs both see "not accrued yet" and pay the customer twice.
 */
@Injectable()
export class InterestAccrualStep {
  private readonly logger = new Logger(InterestAccrualStep.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @InjectModel(InterestAccrualDoc.name) private readonly accruals: Model<InterestAccrualDoc>,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async run(context: EodContext): Promise<CurrencyTotals> {
    const accounts = await this.accounts
      .find({ kind: { $in: ['savings', 'fixed_deposit'] }, status: 'active' })
      .sort({ _id: 1 })
      .lean();

    const totals = new CurrencyTotals();
    let accrued = 0;

    for (const account of accounts) {
      const interest = await this.accrueOne(account, context);
      if (interest) {
        totals.add(interest);
        accrued += 1;
      }
    }

    if (accrued > 0) {
      this.logger.log(
        { businessDate: context.businessDate, accounts: accrued, totals: totals.breakdown() },
        'Interest accrued',
      );
    }
    return totals;
  }

  /** One account, one day. Returns null when nothing was earned or the day is already accrued. */
  private async accrueOne(account: AccountDoc, context: EodContext): Promise<Money | null> {
    const currency = account.currency as CurrencyCode;
    const balance = await this.ledgerBalance(account._id, currency);

    if (balance.minorUnits <= 0) {
      return null;
    }

    const rate = annualRateFraction(account.interestRate) ?? FALLBACK_RATE;
    const interest = multiply(balance, rate / DAYS_IN_YEAR, 'half-even');

    if (interest.minorUnits <= 0) {
      return null;
    }

    try {
      await this.transactionManager.withTransaction((session) =>
        this.claimAndPost({ account, balance, rate, interest, context }, session),
      );
      return interest;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null;
      }
      throw error;
    }
  }

  /** Claim the day with a unique-indexed row, then post. Both or neither. */
  private async claimAndPost(input: AccrualInput, session: ClientSession): Promise<void> {
    const accrualId = newId();

    await this.claimDay(accrualId, input, session);
    const transactionId = await this.postAccrual(accrualId, input, session);

    await this.accruals.updateOne(
      { _id: accrualId },
      { $set: { postedTransactionId: transactionId } },
      { session },
    );
  }

  /** The unique index on `(accountId, accrualDate)` rejects a second claim for the same day. */
  private async claimDay(
    accrualId: string,
    input: AccrualInput,
    session: ClientSession,
  ): Promise<void> {
    await this.accruals.create(
      [
        {
          _id: accrualId,
          accountId: input.account._id,
          accrualDate: input.context.businessDate,
          basis: DAY_COUNT_BASIS,
          balanceMinorUnits: input.balance.minorUnits,
          rate: input.rate,
          minorUnits: input.interest.minorUnits,
          currency: input.interest.currency,
          postedTransactionId: null,
          createdAt: input.context.asOf,
        },
      ],
      { session, ordered: true },
    );
  }

  /** Interest expense up, customer liability up, in the accrual's own session. */
  private async postAccrual(
    accrualId: string,
    input: AccrualInput,
    session: ClientSession,
  ): Promise<string> {
    const posted = await this.ledger.postWithin(
      {
        type: 'interest',
        description: `Interest for ${input.context.businessDate}`,
        actor: { kind: 'system', id: null, label: 'end-of-day' },
        valueDate: input.context.businessDate,
        sourceType: 'interest_accrual',
        sourceId: accrualId,
        lines: [
          {
            accountRef: glRef(GL_INTEREST_EXPENSE),
            direction: 'debit',
            amount: input.interest,
            narrative: DAY_COUNT_BASIS,
          },
          {
            accountRef: customerRef(input.account._id),
            direction: 'credit',
            amount: input.interest,
            narrative: 'Interest earned',
          },
        ],
      },
      session,
    );
    return posted.id;
  }

  private async ledgerBalance(accountId: string, currency: CurrencyCode): Promise<Money> {
    const row = await this.balances
      .findOne({ accountRef: customerRef(accountId), currency })
      .lean();
    return fromMinorUnits(row?.ledgerMinorUnits ?? 0, currency);
  }
}

interface AccrualInput {
  readonly account: AccountDoc;
  readonly balance: Money;
  readonly rate: number;
  readonly interest: Money;
  readonly context: EodContext;
}
