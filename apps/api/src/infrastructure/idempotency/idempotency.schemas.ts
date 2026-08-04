import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument } from 'mongoose';

import { newId } from '../database/identifier.js';
import { IDEMPOTENCY_COLLECTION } from './idempotency.constants.js';

/** Lifecycle of an idempotency record: claimed but unfinished, or holding a replayable response. */
export const IDEMPOTENCY_STATES = { PENDING: 'pending', COMPLETED: 'completed' } as const;
export type IdempotencyState = (typeof IDEMPOTENCY_STATES)[keyof typeof IDEMPOTENCY_STATES];

/**
 * A stored response for an idempotent endpoint (N6).
 *
 * The unique `(scope, key)` index is the whole guarantee: claiming a key inserts a `pending`
 * row, so two concurrent same-key requests cannot both execute — the loser of the insert race
 * either finds the row `completed` and replays it, or finds it `pending` and waits for the
 * winner to finish. `statusCode` and `body` stay null until `save` completes the record, which
 * is how a reader tells a claim from a response. `scope` already folds in the caller, method
 * and route, so one customer's key can never replay another's request.
 */
@Schema({ collection: IDEMPOTENCY_COLLECTION, timestamps: false, versionKey: false })
export class IdempotencyRecordDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true })
  scope!: string;

  @Prop({ type: String, required: true })
  key!: string;

  @Prop({ type: String, required: true, enum: Object.values(IDEMPOTENCY_STATES) })
  state!: IdempotencyState;

  @Prop({ type: Number, default: null })
  statusCode!: number | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  body!: unknown;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type IdempotencyRecordDocument = HydratedDocument<IdempotencyRecordDoc>;
export const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecordDoc);
IdempotencyRecordSchema.index({ scope: 1, key: 1 }, { unique: true });
