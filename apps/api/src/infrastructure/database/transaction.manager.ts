import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { ClientSession, Connection } from 'mongoose';

/** Mongo labels retryable transaction failures rather than using distinct error codes. */
const TRANSIENT_LABEL = 'TransientTransactionError';
const UNKNOWN_COMMIT_LABEL = 'UnknownTransactionCommitResult';

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 20;

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
 * Runs a unit of work inside a MongoDB transaction, with the retry behaviour the driver expects.
 *
 * Two things make this necessary rather than optional:
 *
 *  1. Double-entry postings write a transaction header, N immutable entries, and N balance
 *     updates. A partial write there is a corrupted ledger, not a failed request.
 *  2. Mongo surfaces write conflicts as *transient* errors that the caller is expected to retry.
 *     Under concurrent transfers on one account this happens routinely; without the retry loop
 *     the bank simply drops payments under load.
 *
 * Callers must thread the returned session into every operation inside the callback. An
 * operation that forgets the session silently escapes the transaction.
 */
@Injectable()
export class TransactionManager {
  private readonly logger = new Logger(TransactionManager.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
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
    session.startTransaction({
      readConcern: { level: 'snapshot' },
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
    const ceiling = BASE_BACKOFF_MS * 2 ** (attempt - 1);
    // Deliberately unseeded: the whole point of jitter is that two conflicting transactions
    // must NOT pick the same retry delay. A deterministic source would defeat it.
    // eslint-disable-next-line no-restricted-syntax, sonarjs/pseudo-random -- see above
    const delay = Math.floor(Math.random() * ceiling);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}
