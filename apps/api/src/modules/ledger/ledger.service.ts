import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { isGlRef, normalSideForRef, toAccountRef } from './domain/account-ref.js';
import {
  assertBalanced,
  assertPositiveAmounts,
  signedDelta,
} from './domain/balance-checker.js';
import type {
  PostedEntry,
  PostedTransaction,
  PostingCommand,
  PostingLine,
} from './domain/posting.types.js';
import {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from './infrastructure/ledger.schemas.js';

/**
 * The double-entry ledger.
 *
 * Every movement of value in ICB goes through `post()`. Nothing else may write
 * `ledger_entries` or `account_balances`. The guarantees this buys:
 *
 *  - a transaction is balanced before it is written, per currency;
 *  - header, entries, and balance updates commit atomically or not at all;
 *  - entries are never mutated, so history is reconstructible and auditable;
 *  - concurrent postings against one account retry rather than corrupt or drop.
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(LedgerEntryDoc.name)
    private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountBalanceDoc.name)
    private readonly balances: Model<AccountBalanceDoc>,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  /** Post a balanced transaction, opening its own database transaction. */
  async post(command: PostingCommand): Promise<PostedTransaction> {
    return this.transactionManager.withTransaction((session) =>
      this.postWithin(command, session),
    );
  }

  /**
   * Post inside a caller-supplied session.
   *
   * Used when the posting is one step of a larger unit of work — a transfer that also updates
   * its own status, say. Sharing the session is what keeps those consistent with each other.
   */
  async postWithin(command: PostingCommand, session: ClientSession): Promise<PostedTransaction> {
    assertPositiveAmounts(command.lines);
    assertBalanced(command.lines);

    const bookedAt = this.clock.now();
    const valueDate = command.valueDate ?? this.clock.toIsoDate(bookedAt);
    const transactionId = newId();
    const reference = command.reference ?? newReference('TXN');

    await this.writeHeader(command, { transactionId, reference, valueDate, bookedAt }, session);

    const entries = await this.writeEntries(command, {
      transactionId,
      bookedAt,
      valueDate,
      session,
    });

    await this.applyBalances(command.lines, session, bookedAt);

    this.logger.debug(
      { transactionId, reference, lines: command.lines.length },
      `Posted ${command.type}`,
    );

    return {
      id: transactionId,
      reference,
      type: command.type,
      status: command.status ?? 'posted',
      description: command.description,
      entries,
      bookedAt,
    };
  }

  private async writeHeader(
    command: PostingCommand,
    ids: { transactionId: string; reference: string; valueDate: string; bookedAt: Date },
    session: ClientSession,
  ): Promise<void> {
    await this.transactions.create(
      [
        {
          _id: ids.transactionId,
          reference: ids.reference,
          type: command.type,
          status: command.status ?? 'posted',
          description: command.description,
          actor: command.actor,
          valueDate: ids.valueDate,
          bookedAt: ids.bookedAt,
          settledAt: null,
          reversesTransactionId: command.reversesTransactionId ?? null,
          reversedByTransactionId: null,
          sourceType: command.sourceType ?? null,
          sourceId: command.sourceId ?? null,
          correlationId: command.correlationId ?? null,
          metadata: command.metadata ?? {},
        },
      ],
      { session, ordered: true },
    );
  }

  private async writeEntries(
    command: PostingCommand,
    context: { transactionId: string; bookedAt: Date; valueDate: string; session: ClientSession },
  ): Promise<PostedEntry[]> {
    const documents = command.lines.map((line, index) => {
      const normalSide = normalSideForRef(line.accountRef, line.normalSide);
      return {
        _id: newId(),
        transactionId: context.transactionId,
        accountRef: line.accountRef,
        direction: line.direction,
        minorUnits: line.amount.minorUnits,
        currency: line.amount.currency,
        signedMinorUnits: signedDelta(line.amount.minorUnits, line.direction, normalSide),
        valueDate: line.valueDate ?? context.valueDate,
        bookedAt: context.bookedAt,
        sequence: index,
        narrative: line.narrative ?? null,
        transactionType: command.type,
        transactionStatus: command.status ?? 'posted',
      };
    });

    await this.entries.insertMany(documents, { session: context.session, ordered: true });

    return documents.map((document) => ({
      id: document._id,
      accountRef: document.accountRef,
      direction: document.direction,
      amount: fromMinorUnits(document.minorUnits, document.currency),
      sequence: document.sequence,
      valueDate: document.valueDate,
    }));
  }

  /**
   * Update the cached balance for each touched account.
   *
   * `$inc` is used deliberately: it is atomic server-side, so two concurrent postings against one
   * account both land. Read-modify-write here would lose one of them under the exact conditions
   * a bank sees most — payday, month end, a burst of card authorisations.
   */
  private async applyBalances(
    lines: readonly PostingLine[],
    session: ClientSession,
    asOf: Date,
  ): Promise<void> {
    for (const line of lines) {
      const normalSide = normalSideForRef(line.accountRef, line.normalSide);
      const delta = signedDelta(line.amount.minorUnits, line.direction, normalSide);

      await this.balances.updateOne(
        { accountRef: line.accountRef, currency: line.amount.currency },
        {
          $inc: {
            ledgerMinorUnits: delta,
            debitMinorUnits: line.direction === 'debit' ? line.amount.minorUnits : 0,
            creditMinorUnits: line.direction === 'credit' ? line.amount.minorUnits : 0,
            entryCount: 1,
          },
          $set: { asOf },
          $setOnInsert: {
            _id: newId(),
            accountRef: line.accountRef,
            currency: line.amount.currency,
            normalSide,
            holdMinorUnits: 0,
            overdraftMinorUnits: 0,
          },
        },
        { upsert: true, session },
      );
    }
  }

  /**
   * Reverse a transaction by writing its mirror image.
   *
   * Nothing is deleted or edited. The pair remains visible on the statement, which is both a
   * regulatory expectation and the only honest representation of what happened.
   */
  async reverse(
    transactionId: string,
    reason: string,
    actor: PostingCommand['actor'],
  ): Promise<PostedTransaction> {
    return this.transactionManager.withTransaction(async (session) => {
      const original = await this.transactions.findById(transactionId).session(session).lean();
      if (!original) {
        throw new NotFoundError('Transaction', transactionId);
      }
      if (original.reversedByTransactionId) {
        throw new ConflictError('This transaction has already been reversed', { transactionId });
      }

      const lines = await this.mirrorLines(transactionId, original.reference, session);

      const reversal = await this.postWithin(
        {
          type: 'reversal',
          description: `Reversal of ${original.reference}: ${reason}`,
          actor,
          lines,
          reference: newReference('REV'),
          reversesTransactionId: transactionId,
          metadata: { reason, originalReference: original.reference },
        },
        session,
      );

      await this.transactions.updateOne(
        { _id: transactionId },
        { $set: { status: 'reversed', reversedByTransactionId: reversal.id } },
        { session },
      );

      return reversal;
    });
  }

  /** Each original posting, flipped. Amounts are unchanged; only the direction inverts. */
  private async mirrorLines(
    transactionId: string,
    originalReference: string,
    session: ClientSession,
  ): Promise<PostingLine[]> {
    const originalEntries = await this.entries
      .find({ transactionId })
      .sort({ sequence: 1 })
      .session(session)
      .lean();

    return originalEntries.map((entry) => ({
      accountRef: toAccountRef(entry.accountRef),
      direction: entry.direction === 'debit' ? 'credit' : 'debit',
      amount: fromMinorUnits(entry.minorUnits, entry.currency as CurrencyCode),
      narrative: `Reversal of ${originalReference}`,
    }));
  }

  /** Current cached balance for an account. Zero when the account has never been posted to. */
  async getBalance(accountRef: string, currency: CurrencyCode): Promise<Money> {
    const balance = await this.balances.findOne({ accountRef, currency }).lean();
    return fromMinorUnits(balance?.ledgerMinorUnits ?? 0, currency);
  }

  /** Mark a transaction settled once its rail's settlement window has passed. */
  async markSettled(transactionId: string, session?: ClientSession): Promise<void> {
    const query = this.transactions.updateOne(
      { _id: transactionId },
      { $set: { status: 'settled', settledAt: this.clock.now() } },
    );
    await (session ? query.session(session) : query);
  }

  /** True when the reference belongs to an internal GL account rather than a customer. */
  isInternal(accountRef: string): boolean {
    return isGlRef(toAccountRef(accountRef));
  }
}
