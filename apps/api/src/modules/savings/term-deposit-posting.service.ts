import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import { GL_INTEREST_EXPENSE } from '../ledger/domain/chart-of-accounts.js';
import type { PostingActor } from '../ledger/domain/posting.types.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { accruedInterestOn } from './domain/interest.js';
import { toDepositTerms } from './infrastructure/term-deposit.mapper.js';
import { TermDepositDoc } from './infrastructure/term-deposit.schemas.js';

/** Every leg a term deposit ever posts, in one place. */
const SOURCE_TYPE = 'term_deposit';
const SYSTEM_ACTOR: PostingActor = { kind: 'system', id: null, label: 'term-deposits' };

export interface OpenDepositAccountInput {
  readonly customerId: string;
  readonly currency: CurrencyCode;
  readonly termMonths: number;
  readonly rate: number;
  readonly reference: string;
}

/**
 * The ledger side of a term deposit.
 *
 * Isolated from the workflow services because opening, accruing, breaking and maturing all move
 * value the same four ways — principal in, interest credited, interest clawed back, proceeds
 * out — and every one of them must be a balanced posting through LedgerService. Keeping the legs
 * here means a new lifecycle step cannot invent a fifth, unbalanced way to move money.
 */
@Injectable()
export class TermDepositPostingService {
  constructor(
    @InjectModel(TermDepositDoc.name) private readonly deposits: Model<TermDepositDoc>,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
  ) {}

  /** The principal needs somewhere to sit that is not the customer's current account. */
  async openDepositAccount(
    input: OpenDepositAccountInput,
    session: ClientSession,
  ): Promise<string> {
    const account = await this.accounts.open(
      {
        customerId: input.customerId,
        productCode: 'TD_FIXED',
        productName: `${input.termMonths}-month term deposit`,
        kind: 'fixed_deposit',
        currency: input.currency,
        nickname: input.reference,
        interestRate: input.rate,
      },
      session,
    );
    return account.id;
  }

  /** Principal in: the funding account is debited and the deposit account credited. */
  async postPrincipal(
    depositId: string,
    accounts: { readonly from: string; readonly to: string },
    amount: Money,
    session: ClientSession,
  ): Promise<void> {
    await this.ledger.postWithin(
      {
        type: 'deposit',
        description: 'Term deposit funded',
        actor: SYSTEM_ACTOR,
        sourceType: SOURCE_TYPE,
        sourceId: depositId,
        lines: [
          { accountRef: customerRef(accounts.from), direction: 'debit', amount },
          { accountRef: customerRef(accounts.to), direction: 'credit', amount },
        ],
      },
      session,
    );
  }

  /**
   * Bring credited interest up to `onIso`, posting only the difference.
   *
   * The cumulative-minus-paid shape is deliberate: adding a freshly rounded amount every day
   * drifts away from the contracted ACT/365 figure, and a customer who checks the arithmetic at
   * maturity would find the bank a few minor units out. Returns the total interest credited.
   */
  async accrueTo(
    deposit: TermDepositDoc,
    onIso: string,
    session: ClientSession,
  ): Promise<number> {
    const earned = accruedInterestOn(toDepositTerms(deposit), onIso);
    const delta = earned - deposit.interestPaidMinorUnits;

    if (delta <= 0) {
      await this.deposits.updateOne(
        { _id: deposit._id },
        { $set: { accruedTo: onIso } },
        { session },
      );
      return deposit.interestPaidMinorUnits;
    }

    const amount = fromMinorUnits(delta, deposit.currency as CurrencyCode);
    await this.ledger.postWithin(
      {
        type: 'interest',
        description: `Interest on ${deposit.reference}`,
        actor: SYSTEM_ACTOR,
        sourceType: SOURCE_TYPE,
        sourceId: deposit._id,
        valueDate: onIso,
        lines: [
          { accountRef: glRef(GL_INTEREST_EXPENSE), direction: 'debit', amount },
          {
            accountRef: customerRef(deposit.accountId),
            direction: 'credit',
            amount,
            narrative: `Interest to ${onIso}`,
          },
        ],
      },
      session,
    );

    await this.deposits.updateOne(
      { _id: deposit._id },
      { $inc: { interestPaidMinorUnits: delta }, $set: { accruedTo: onIso } },
      { session },
    );
    return earned;
  }

  /**
   * Take back the forfeited share of interest already credited.
   *
   * Written as its own posting rather than by netting it off the payout so that the statement
   * shows the penalty as a line the customer can point at.
   */
  async clawBackInterest(
    deposit: TermDepositDoc,
    minorUnits: number,
    session: ClientSession,
  ): Promise<void> {
    if (minorUnits <= 0) {
      return;
    }
    const amount = fromMinorUnits(minorUnits, deposit.currency as CurrencyCode);

    await this.ledger.postWithin(
      {
        type: 'adjustment',
        description: `Early break penalty on ${deposit.reference}`,
        actor: SYSTEM_ACTOR,
        sourceType: SOURCE_TYPE,
        sourceId: deposit._id,
        lines: [
          {
            accountRef: customerRef(deposit.accountId),
            direction: 'debit',
            amount,
            narrative: 'Interest forfeited on early break',
          },
          { accountRef: glRef(GL_INTEREST_EXPENSE), direction: 'credit', amount },
        ],
      },
      session,
    );

    await this.deposits.updateOne(
      { _id: deposit._id },
      { $inc: { interestPaidMinorUnits: -minorUnits } },
      { session },
    );
  }

  /** Proceeds out: the deposit account is emptied into a customer account. */
  async payOut(
    deposit: TermDepositDoc,
    toAccountId: string,
    minorUnits: number,
    session: ClientSession,
  ): Promise<void> {
    if (minorUnits <= 0) {
      return;
    }
    const amount = fromMinorUnits(minorUnits, deposit.currency as CurrencyCode);

    await this.ledger.postWithin(
      {
        type: 'withdrawal',
        description: `Proceeds of ${deposit.reference}`,
        actor: SYSTEM_ACTOR,
        sourceType: SOURCE_TYPE,
        sourceId: deposit._id,
        lines: [
          { accountRef: customerRef(deposit.accountId), direction: 'debit', amount },
          {
            accountRef: customerRef(toAccountId),
            direction: 'credit',
            amount,
            narrative: `From ${deposit.reference}`,
          },
        ],
      },
      session,
    );
  }

  /** Close the account a finished deposit sat in. Run after the money has settled, never before. */
  async closeDepositAccount(deposit: TermDepositDoc, reason: string): Promise<void> {
    await this.accounts.setStatus(deposit.accountId, 'closed', reason);
  }

  /** Reload inside a session so an accrual reads the interest total nobody else has changed. */
  async loadInSession(depositId: string, session: ClientSession): Promise<TermDepositDoc | null> {
    return this.deposits.findById(depositId).session(session).lean();
  }
}
