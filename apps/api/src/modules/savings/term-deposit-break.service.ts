import type { BreakDepositQuote, TermDeposit } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { quoteBreak } from './domain/interest.js';
import { toBreakQuote, toDepositTerms } from './infrastructure/term-deposit.mapper.js';
import type { BreakQuoteRecord } from './infrastructure/term-deposit.schemas.js';
import { TermDepositDoc } from './infrastructure/term-deposit.schemas.js';
import { TermDepositPostingService } from './term-deposit-posting.service.js';
import { TermDepositsService } from './term-deposits.service.js';

/** A quote is good for fifteen minutes — long enough to read it, short enough to stay true. */
const QUOTE_TTL_MS = 15 * 60 * 1000;
const ACTIVE = 'active';

/**
 * Breaking a term deposit early.
 *
 * Two steps, deliberately: the customer is quoted a price and then confirms it. A single
 * "break it" call would tell them what it cost only after the money had already moved, which is
 * how a product ends up in front of an ombudsman. The quoted figures are persisted and are the
 * ones executed, so the price on the screen is the price charged.
 */
@Injectable()
export class TermDepositBreakService {
  private readonly logger = new Logger(TermDepositBreakService.name);

  constructor(
    @InjectModel(TermDepositDoc.name) private readonly deposits: Model<TermDepositDoc>,
    private readonly termDeposits: TermDepositsService,
    private readonly postings: TermDepositPostingService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  /**
   * Price an early break and hold that price.
   *
   * This read writes: issuing a quote is what makes the price binding, and a quote nobody
   * recorded is a promise the bank cannot keep.
   */
  async quote(customerId: string, depositId: string): Promise<BreakDepositQuote> {
    const deposit = await this.termDeposits.loadDeposit(customerId, depositId);
    this.assertBreakable(deposit);

    const today = this.clock.today();
    const maths = quoteBreak(toDepositTerms(deposit), today);
    const record: BreakQuoteRecord = {
      accruedInterestMinorUnits: maths.accruedInterestMinorUnits,
      penaltyMinorUnits: maths.penaltyMinorUnits,
      netProceedsMinorUnits: maths.netProceedsMinorUnits,
      interestForfeitedMinorUnits: maths.interestForfeitedMinorUnits,
      quotedOn: today,
      expiresAt: new Date(this.clock.epochMs() + QUOTE_TTL_MS),
    };

    await this.deposits.updateOne({ _id: deposit._id }, { $set: { breakQuote: record } });
    return toBreakQuote(deposit, record);
  }

  /** Execute a quote the customer has already been shown. */
  async execute(customerId: string, depositId: string): Promise<TermDeposit> {
    const deposit = await this.termDeposits.loadDeposit(customerId, depositId);
    this.assertBreakable(deposit);
    const quote = this.assertQuoted(deposit);

    await this.transactionManager.withTransaction((session) =>
      this.breakWithin(deposit, quote, session),
    );
    await this.postings.closeDepositAccount(deposit, 'Term deposit broken early');

    this.logger.log(
      { depositId, penaltyMinorUnits: quote.penaltyMinorUnits },
      'Term deposit broken early',
    );
    return this.termDeposits.get(customerId, depositId);
  }

  /**
   * One unit of work: credit the interest earned to the break date, take back the forfeited
   * share, pay the net proceeds out, and close the contract.
   */
  private async breakWithin(
    deposit: TermDepositDoc,
    quote: BreakQuoteRecord,
    session: ClientSession,
  ): Promise<void> {
    const current = (await this.postings.loadInSession(deposit._id, session)) ?? deposit;

    await this.postings.accrueTo(current, quote.quotedOn, session);
    await this.postings.clawBackInterest(current, quote.penaltyMinorUnits, session);
    await this.postings.payOut(
      current,
      current.rolloverAccountId ?? current.fundingAccountId,
      quote.netProceedsMinorUnits,
      session,
    );

    await this.deposits.updateOne(
      { _id: deposit._id },
      { $set: { status: 'broken', brokenAt: this.clock.now(), breakQuote: null } },
      { session },
    );
  }

  private assertBreakable(deposit: TermDepositDoc): void {
    if (deposit.status !== ACTIVE) {
      throw new ConflictError('Only an active term deposit can be broken', {
        depositId: deposit._id,
        status: deposit.status,
      });
    }
  }

  /** A break must be priced before it is executed, and priced today. */
  private assertQuoted(deposit: TermDepositDoc): BreakQuoteRecord {
    const quote = deposit.breakQuote;

    if (
      !quote ||
      quote.quotedOn !== this.clock.today() ||
      quote.expiresAt.getTime() <= this.clock.epochMs()
    ) {
      throw new ConflictError('Request a break quote before breaking this deposit', {
        depositId: deposit._id,
      });
    }
    return quote;
  }
}
