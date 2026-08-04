import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import type {
  IdempotencyClaim,
  IdempotencyRecord,
  IdempotencyStore,
} from '../../common/interceptors/idempotency-store.port.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { isDuplicateKeyError } from '../database/mongo-errors.js';
import { IDEMPOTENCY_STATES, IdempotencyRecordDoc } from './idempotency.schemas.js';

/**
 * Mongo-backed binding of the `IDEMPOTENCY_STORE` port (N6).
 *
 * `claim` is an insert of a pending row behind the unique `(scope, key)` index — the atomic
 * in-flight marker that closes the find → execute → save race: two concurrent same-key
 * requests can no longer both run the handler, because the second insert fails and the loser
 * is told whether the key is still `pending` or already `completed`. `save` completes the
 * caller's pending row, or inserts first-write-wins when the caller never claimed. Timestamps
 * come from ClockService (N8), so a record created under simulated time carries simulated time.
 */
@Injectable()
export class MongoIdempotencyStore implements IdempotencyStore {
  constructor(
    @InjectModel(IdempotencyRecordDoc.name)
    private readonly records: Model<IdempotencyRecordDoc>,
    private readonly clock: ClockService,
  ) {}

  /** The completed response for `(scope, key)`, or null when absent or still pending. */
  async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const row = await this.records.findOne({ scope, key }).lean().exec();
    return row === null ? null : toReplayable(row);
  }

  async claim(scope: string, key: string): Promise<IdempotencyClaim> {
    try {
      await this.records.create({
        scope,
        key,
        state: IDEMPOTENCY_STATES.PENDING,
        statusCode: null,
        body: null,
        createdAt: this.clock.now(),
      });
      return { outcome: 'claimed' };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
    const existing = await this.records.findOne({ scope, key }).lean().exec();
    const record = existing === null ? null : toReplayable(existing);
    return record === null
      ? { outcome: 'pending' }
      : { outcome: 'completed', record };
  }

  async save(record: IdempotencyRecord): Promise<void> {
    const completed = {
      ...record,
      state: IDEMPOTENCY_STATES.COMPLETED,
      createdAt: this.clock.now(),
    };
    const claimed = await this.records.updateOne(
      { scope: record.scope, key: record.key, state: IDEMPOTENCY_STATES.PENDING },
      { $set: completed },
    );
    if (claimed.matchedCount > 0) {
      return;
    }
    try {
      await this.records.create(completed);
    } catch (error) {
      // First write wins: a concurrent request with the same key already stored its response.
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  /** Drop a claim whose execution failed, so a retry is not locked out by it. */
  async release(scope: string, key: string): Promise<void> {
    await this.records.deleteOne({ scope, key, state: IDEMPOTENCY_STATES.PENDING });
  }
}

/** A row is replayable only once it holds a response; a pending claim reads as absent. */
function toReplayable(row: IdempotencyRecordDoc): IdempotencyRecord | null {
  if (row.statusCode === null) {
    return null;
  }
  return { scope: row.scope, key: row.key, statusCode: row.statusCode, body: row.body };
}
