import { fromMinorUnits, isCurrencyCode, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../infrastructure/database/identifier.js';
import { isDuplicateKeyError } from '../../infrastructure/database/mongo-errors.js';
import { InterestAccrualDoc } from '../../simulation/eod/infrastructure/eod.schemas.js';
import { addDays } from '../savings/domain/date-maths.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { AccountBalanceDoc } from '../ledger/infrastructure/ledger.schemas.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import { policyFor } from './domain/accrual-policy.js';
import { yearFraction } from './domain/day-count.js';
import { bandedInterest, effectiveRate } from './domain/tiered-rates.js';

/** Interest-bearing account kinds the engine accrues. */
const INTEREST_BEARING_KINDS: readonly string[] = ['current', 'savings', 'fixed_deposit'];

export interface AccrualRunSummary {
  readonly accountsConsidered: number;
  readonly accountsAccrued: number;
  readonly minorUnitsByCurrency: Record<string, number>;
}

/**
 * The daily accrual.
 *
 * One row per account per day in `interest_accruals`: the balance held, the blended rate, the
 * convention, and the interest earned. Nothing is posted here — posting is the capitaliser's
 * job, on the account's schedule — so a day's accrual is pure measurement, and the claim row
 * guarded by the unique index on `(accountId, accrualDate)` is the whole idempotency story:
 * a replay loses the race against the index and records nothing twice.
 *
 * The same index guards the end-of-day stub's accrual step, so whichever engine reaches a
 * date first owns it; the other stands down.
 */
@Injectable()
export class InterestAccrualService {
  private readonly logger = new Logger(InterestAccrualService.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @InjectModel(InterestAccrualDoc.name) private readonly accruals: Model<InterestAccrualDoc>,
  ) {}

  async run(businessDate: string, asOf: Date): Promise<AccrualRunSummary> {
    const accounts = await this.accounts
      .find({ kind: { $in: [...INTEREST_BEARING_KINDS] }, status: 'active' })
      .sort({ _id: 1 })
      .lean();

    let accrued = 0;
    const totals: Record<string, number> = {};
    for (const account of accounts) {
      const interest = await this.accrueOne(account, businessDate, asOf);
      if (interest !== null && interest.minorUnits > 0) {
        accrued += 1;
        totals[interest.currency] = (totals[interest.currency] ?? 0) + interest.minorUnits;
      }
    }

    if (accrued > 0) {
      this.logger.log({ businessDate, accountsAccrued: accrued, totals }, 'Interest accrued');
    }
    return { accountsConsidered: accounts.length, accountsAccrued: accrued, minorUnitsByCurrency: totals };
  }

  /** One account, one day. Returns null when nothing was earned or the day is already claimed. */
  private async accrueOne(
    account: AccountDoc,
    businessDate: string,
    asOf: Date,
  ): Promise<Money | null> {
    if (!isCurrencyCode(account.currency)) {
      return null;
    }
    const currency: CurrencyCode = account.currency;
    const balance = await this.ledgerBalance(account._id, currency);
    const policy = policyFor(account.kind, currency, account.interestRate);
    if (balance <= 0 || policy === null) {
      return null;
    }

    const fraction = yearFraction(policy.basis, businessDate, addDays(businessDate, 1));
    const minorUnits = bandedInterest(balance, policy.bands, fraction);
    if (minorUnits <= 0) {
      return null;
    }

    const claimed = await this.claimDay(account, {
      businessDate,
      asOf,
      balance,
      rate: effectiveRate(balance, policy.bands),
      basis: policy.basis,
      minorUnits,
      currency,
    });
    return claimed ? fromMinorUnits(minorUnits, currency) : null;
  }

  /** Insert the claim row; the unique index rejects a second accrual for the same day. */
  private async claimDay(
    account: AccountDoc,
    accrual: {
      businessDate: string;
      asOf: Date;
      balance: number;
      rate: number;
      basis: string;
      minorUnits: number;
      currency: CurrencyCode;
    },
  ): Promise<boolean> {
    try {
      await this.accruals.create([
        {
          _id: newId(),
          accountId: account._id,
          accrualDate: accrual.businessDate,
          basis: accrual.basis,
          balanceMinorUnits: accrual.balance,
          rate: accrual.rate,
          minorUnits: accrual.minorUnits,
          currency: accrual.currency,
          postedTransactionId: null,
          createdAt: accrual.asOf,
        },
      ]);
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return false;
      }
      throw error;
    }
  }

  private async ledgerBalance(accountId: string, currency: CurrencyCode): Promise<number> {
    const row = await this.balances
      .findOne({ accountRef: customerRef(accountId), currency })
      .lean();
    return row?.ledgerMinorUnits ?? 0;
  }
}
