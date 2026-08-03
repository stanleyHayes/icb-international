import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { ClientSession, Connection } from 'mongoose';

import { KeyedMutex } from './keyed-mutex.js';

/** Mongo labels retryable transaction failures rather than using distinct error codes. */
const TRANSIENT_LABEL = 'TransientTransactionError';
const UNKNOWN_COMMIT_LABEL = 'UnknownTransactionCommitResult';

/**
 * Retry budget.
 *
 * This is the backstop, not the primary defence — contention is handled by serialising on
 * `lockKeys` before the transaction opens. What is left for the retry loop is cross-process
 * contention and the occasional unrelated conflict, both of which clear in a couple of attempts.
 * The budget stays generous because the cost of exhausting it is a dropped payment.
 */
const MAX_ATTEMPTS = 12;
const BASE_BACKOFF_MS = 15;
const MAX_BACKOFF_MS = 750;

export interface TransactionOptions {
  /**
   * Documents this unit of work will contend on, named by a stable application-level key
   * (for the ledger, the account ref). Work sharing a key is serialised in-process so it
   * queues instead of colliding. Omit when the work touches nothing hot.
   */
  lockKeys?: readonly string[];
}

interface LabelledError {
  hasErrorLabel?: (label: string) => boolean;
}

function hasLabel(error: unknown, label: string): boolean {
  const candidate = error as LabelledError;
  return typeof candidate?.hasErrorLabel === 'function' && candidate.hasErrorLabel(label);
}

function isRetryable(error: unknown): boolean {
  return hasLabel(error, TRANSIENT_LABEL) || hasLabel(error, UNKNOWN_COMMIT_LABEL);
}

/**
 * Runs a unit of work inside a MongoDB transaction.
 *
 * A double-entry posting writes a transaction header, N immutable entries, and N balance updates.
 * A partial write there is a corrupted ledger, not a failed request — hence the transaction.
 *
 * Contention is then handled in two layers, and the order matters:
 *
 *  1. **Serialise, via `lockKeys`.** Callers name the documents they will contend on. Work
 *     sharing a key queues instead of colliding. This is the primary defence, because postings
 *     against one account are serial work whatever we do — the choice is only whether they take
 *     turns or fight.
 *  2. **Retry, underneath.** Mongo reports write conflicts as *transient* errors the caller is
 *     expected to retry. This catches what layer 1 cannot see: contention between processes, and
 *     conflicts on documents the caller did not think to declare.
 *
 * Callers must thread the supplied session into every operation inside the callback. An operation
 * that forgets the session silently escapes the transaction.
 */
@Injectable()
export class TransactionManager {
  private readonly logger = new Logger(TransactionManager.name);
  private readonly mutex = new KeyedMutex();

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async withTransaction<T>(
    work: (session: ClientSession) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    return this.mutex.withKeys(options.lockKeys ?? [], () => this.attemptUntilCommitted(work));
  }

  private async attemptUntilCommitted<T>(
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const session = await this.connection.startSession();
      try {
        return await this.runAttempt(session, work);
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
          throw error;
        }
        this.logger.warn(
          { attempt, maxAttempts: MAX_ATTEMPTS },
          'Transaction conflicted; retrying',
        );
        await this.backOff(attempt);
      } finally {
        await session.endSession();
      }
    }

    /* c8 ignore next 2 — the loop either returns or throws; this satisfies the compiler. */
    throw lastError;
  }

  private async runAttempt<T>(
    session: ClientSession,
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    // `majority` rather than `snapshot`. Snapshot isolation makes any two transactions that
    // touch the same document conflict, and every posting touches the same account balance.
    // Nothing here needs repeatable reads: balances are updated with `$inc`, which is an atomic
    // blind write, and the entries are inserts. Atomicity — the property the ledger actually
    // depends on — comes from the transaction either way.
    session.startTransaction({
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });

    try {
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      throw error;
    }
  }

  /**
   * Exponential back-off with full jitter. Jitter matters here: without it, N transactions that
   * conflict at the same instant retry at the same instant and conflict again.
   */
  private async backOff(attempt: number): Promise<void> {
    const ceiling = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
    // Deliberately unseeded: the whole point of jitter is that two conflicting transactions
    // must NOT pick the same retry delay. A deterministic source would defeat it.
    // eslint-disable-next-line no-restricted-syntax, sonarjs/pseudo-random -- see above
    const delay = Math.floor(Math.random() * ceiling);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
