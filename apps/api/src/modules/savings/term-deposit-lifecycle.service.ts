import { fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { resolveRateBand } from './domain/rate-bands.js';
import type { CreateDepositInput } from './infrastructure/term-deposit.factory.js';
import { TermDepositDoc } from './infrastructure/term-deposit.schemas.js';
import { TermDepositPostingService } from './term-deposit-posting.service.js';
import { TermDepositsService } from './term-deposits.service.js';

const ACTIVE = 'active';

/**
 * The unattended half of a term deposit: daily accrual and maturity.
 *
 * Both are driven by the simulation clock rather than by wall time, so an operator can advance
 * the bank a year and watch interest land day by day and deposits mature, roll over or pay out
 * exactly as they would have.
 */
@Injectable()
export class TermDepositLifecycleService {
  private readonly logger = new Logger(TermDepositLifecycleService.name);

  constructor(
    @InjectModel(TermDepositDoc.name) private readonly deposits: Model<TermDepositDoc>,
    private readonly termDeposits: TermDepositsService,
    private readonly postings: TermDepositPostingService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  /**
   * Credit every active deposit with the interest it has earned since it was last accrued.
   *
   * Idempotent: the posting is always "what has been earned minus what has been paid", so
   * running twice in a day, or catching up after a week of downtime, credits the right amount
   * exactly once. Returns the number of deposits that received a posting.
   */
  async accrueInterest(asOf?: string): Promise<number> {
    const on = asOf ?? this.clock.today();
    const active = await this.deposits
      .find({ status: ACTIVE, accruedTo: { $lt: on } })
      .lean();

    let credited = 0;
    for (const deposit of active) {
      const upTo = deposit.maturesOn < on ? deposit.maturesOn : on;
      if (upTo <= deposit.accruedTo) {
        continue;
      }
      await this.transactionManager.withTransaction((session) =>
        this.postings.accrueTo(deposit, upTo, session),
      );
      credited += 1;
    }

    this.logger.log({ asOf: on, credited }, 'Term deposit interest accrued');
    return credited;
  }

  /**
   * Settle every deposit that has reached its maturity date.
   *
   * Returns the ids of the deposits that matured. Each is settled in its own transaction so one
   * failing contract cannot hold up the rest of the book.
   */
  async processMaturities(asOf?: string): Promise<string[]> {
    const on = asOf ?? this.clock.today();
    const due = await this.deposits.find({ status: ACTIVE, maturesOn: { $lte: on } }).lean();
    const matured: string[] = [];

    for (const deposit of due) {
      await this.transactionManager.withTransaction((session) => this.mature(deposit, session));
      await this.postings.closeDepositAccount(deposit, 'Term deposit matured');
      matured.push(deposit._id);
    }

    this.logger.log({ asOf: on, matured: matured.length }, 'Term deposits matured');
    return matured;
  }

  /**
   * Pay the whole balance out to the nominated account, then re-invest whatever the maturity
   * instruction says. Paying out first keeps the money in a customer account at every step, so
   * there is no instant at which the proceeds belong to nobody.
   */
  private async mature(deposit: TermDepositDoc, session: ClientSession): Promise<void> {
    const interest = await this.postings.accrueTo(deposit, deposit.maturesOn, session);
    const total = deposit.principalMinorUnits + interest;
    const destination = deposit.rolloverAccountId ?? deposit.fundingAccountId;

    await this.postings.payOut(deposit, destination, total, session);
    await this.deposits.updateOne(
      { _id: deposit._id },
      { $set: { status: 'matured', maturedAt: this.clock.now() } },
      { session },
    );

    await this.rollOver(deposit, destination, rolloverAmount(deposit, total), session);
  }

  /**
   * Re-invest at the rate card in force today, not at the rate the old deposit carried.
   *
   * A rollover that no longer qualifies for any band — the customer took the interest and the
   * principal now sits below the minimum — simply does not happen, and the money stays in the
   * destination account rather than being locked away on terms nobody offers.
   */
  private async rollOver(
    deposit: TermDepositDoc,
    destination: string,
    minorUnits: number,
    session: ClientSession,
  ): Promise<void> {
    if (minorUnits <= 0) {
      return;
    }
    const currency = deposit.currency as CurrencyCode;
    const band = resolveRateBand(deposit.termMonths, minorUnits, currency);
    if (!band) {
      this.logger.warn(
        { depositId: deposit._id, minorUnits },
        'Maturing deposit no longer qualifies for a rate band; proceeds left in the account',
      );
      return;
    }

    await this.termDeposits.createDeposit(
      {
        customerId: deposit.customerId,
        fundingAccountId: destination,
        principal: fromMinorUnits(minorUnits, currency),
        termMonths: deposit.termMonths,
        rate: band.rate,
        maturityInstruction:
          deposit.maturityInstruction as CreateDepositInput['maturityInstruction'],
        rolloverAccountId: deposit.rolloverAccountId,
        rolledFromDepositId: deposit._id,
      },
      session,
    );
  }
}

/** How much of the proceeds the maturity instruction re-invests. */
function rolloverAmount(deposit: TermDepositDoc, totalMinorUnits: number): number {
  switch (deposit.maturityInstruction) {
    case 'rollover_all':
      return totalMinorUnits;
    case 'rollover_principal':
      return deposit.principalMinorUnits;
    default:
      return 0;
  }
}
