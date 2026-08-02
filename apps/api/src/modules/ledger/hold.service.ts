import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountBalanceDoc, HoldDoc } from './infrastructure/ledger.schemas.js';

export interface PlaceHoldCommand {
  readonly accountRef: string;
  readonly amount: Money;
  readonly reason: string;
  readonly expiresInMs: number;
  readonly sourceType?: string;
  readonly sourceId?: string;
}

export interface HoldRecord {
  readonly id: string;
  readonly accountRef: string;
  readonly amount: Money;
  readonly reason: string;
  readonly placedAt: Date;
  readonly expiresAt: Date;
  readonly releasedAt: Date | null;
}

/**
 * Authorisation holds.
 *
 * A hold reserves *available* balance without moving value. It is what makes a card
 * authorisation, a pending wire, or a cheque deposit behave the way a customer expects: the
 * money is visibly spoken for before it has actually gone anywhere.
 *
 * Holds are tracked separately from the ledger on purpose. Posting a hold as a real entry would
 * make the ledger balance state that never happened, and unwinding it on expiry would litter
 * every statement with pairs of postings that mean nothing to the customer.
 */
@Injectable()
export class HoldService {
  private readonly logger = new Logger(HoldService.name);

  constructor(
    @InjectModel(HoldDoc.name) private readonly holds: Model<HoldDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async place(command: PlaceHoldCommand): Promise<HoldRecord> {
    return this.transactionManager.withTransaction((session) => this.placeWithin(command, session));
  }

  async placeWithin(command: PlaceHoldCommand, session: ClientSession): Promise<HoldRecord> {
    if (command.amount.minorUnits <= 0) {
      throw new ConflictError('A hold must be for a positive amount', {
        accountRef: command.accountRef,
      });
    }

    const placedAt = this.clock.now();
    const expiresAt = new Date(placedAt.getTime() + command.expiresInMs);
    const id = newId();

    await this.writeHold({ id, command, placedAt, expiresAt }, session);
    await this.adjustHoldTotal(
      command.accountRef,
      command.amount.currency,
      command.amount.minorUnits,
      session,
    );

    return {
      id,
      accountRef: command.accountRef,
      amount: command.amount,
      reason: command.reason,
      placedAt,
      expiresAt,
      releasedAt: null,
    };
  }

  private async writeHold(
    input: { id: string; command: PlaceHoldCommand; placedAt: Date; expiresAt: Date },
    session: ClientSession,
  ): Promise<void> {
    await this.holds.create(
      [
        {
          _id: input.id,
          accountRef: input.command.accountRef,
          minorUnits: input.command.amount.minorUnits,
          currency: input.command.amount.currency,
          reason: input.command.reason,
          sourceType: input.command.sourceType ?? null,
          sourceId: input.command.sourceId ?? null,
          placedAt: input.placedAt,
          expiresAt: input.expiresAt,
          releasedAt: null,
          releaseReason: null,
        },
      ],
      { session, ordered: true },
    );
  }

  async release(holdId: string, reason: string, session?: ClientSession): Promise<void> {
    const run = async (activeSession: ClientSession): Promise<void> => {
      const hold = await this.holds.findById(holdId).session(activeSession).lean();
      if (!hold) {
        throw new NotFoundError('Hold', holdId);
      }
      if (hold.releasedAt) {
        throw new ConflictError('This hold has already been released', { holdId });
      }

      await this.holds.updateOne(
        { _id: holdId, releasedAt: null },
        { $set: { releasedAt: this.clock.now(), releaseReason: reason } },
        { session: activeSession },
      );

      await this.adjustHoldTotal(
        hold.accountRef,
        hold.currency as CurrencyCode,
        -hold.minorUnits,
        activeSession,
      );
    };

    if (session) {
      await run(session);
      return;
    }
    await this.transactionManager.withTransaction(run);
  }

  /** Release every hold attached to a source, e.g. when a transfer completes or is cancelled. */
  async releaseBySource(
    sourceType: string,
    sourceId: string,
    reason: string,
    session: ClientSession,
  ): Promise<number> {
    const open = await this.holds
      .find({ sourceType, sourceId, releasedAt: null })
      .session(session)
      .lean();

    for (const hold of open) {
      await this.release(hold._id, reason, session);
    }
    return open.length;
  }

  /**
   * Sweep holds whose expiry has passed. Run by the end-of-day pipeline and by a periodic job —
   * an authorisation that is never captured must not pin a customer's balance forever.
   */
  async expireDue(): Promise<number> {
    const now = this.clock.now();
    const due = await this.holds.find({ releasedAt: null, expiresAt: { $lte: now } }).lean();

    for (const hold of due) {
      await this.release(hold._id, 'Authorisation expired');
    }

    if (due.length > 0) {
      this.logger.log({ count: due.length }, 'Expired authorisation holds');
    }
    return due.length;
  }

  async totalFor(accountRef: string, currency: CurrencyCode): Promise<Money> {
    const balance = await this.balances.findOne({ accountRef, currency }).lean();
    return fromMinorUnits(balance?.holdMinorUnits ?? 0, currency);
  }

  async listOpen(accountRef: string): Promise<HoldRecord[]> {
    const open = await this.holds.find({ accountRef, releasedAt: null }).sort({ placedAt: -1 }).lean();
    return open.map((hold) => ({
      id: hold._id,
      accountRef: hold.accountRef,
      amount: fromMinorUnits(hold.minorUnits, hold.currency as CurrencyCode),
      reason: hold.reason,
      placedAt: hold.placedAt,
      expiresAt: hold.expiresAt,
      releasedAt: hold.releasedAt,
    }));
  }

  private async adjustHoldTotal(
    accountRef: string,
    currency: CurrencyCode,
    deltaMinorUnits: number,
    session: ClientSession,
  ): Promise<void> {
    await this.balances.updateOne(
      { accountRef, currency },
      {
        $inc: { holdMinorUnits: deltaMinorUnits },
        $set: { asOf: this.clock.now() },
        $setOnInsert: {
          _id: newId(),
          accountRef,
          currency,
          normalSide: 'credit',
          ledgerMinorUnits: 0,
          debitMinorUnits: 0,
          creditMinorUnits: 0,
          overdraftMinorUnits: 0,
          entryCount: 0,
        },
      },
      { upsert: true, session },
    );
  }
}
