import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../database/identifier.js';

export const OUTBOX_STATES = {
  Pending: 'pending',
  Publishing: 'publishing',
  Delivered: 'delivered',
  Failed: 'failed',
} as const;
export type OutboxState = (typeof OUTBOX_STATES)[keyof typeof OUTBOX_STATES];

/**
 * Transactional outbox (agent_plan.md §5).
 *
 * An event is inserted in the same Mongo transaction as the state change it describes, so the
 * two can never diverge: either both commit or neither does. The drain processor later moves
 * each row `pending → publishing → delivered` (or `failed` once attempts are exhausted), with
 * `availableAt` deferring retries — the `state + availableAt` index is exactly the drain's
 * claim query.
 */
@Schema({ collection: 'outbox_events', timestamps: true, versionKey: false })
export class OutboxEventDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  type!: string;

  @Prop({ type: Object, required: true })
  payload!: Record<string, unknown>;

  /**
   * The request that caused this event, so the delivery hop — however much later it runs —
   * logs against the same thread as the state change that produced it.
   */
  @Prop({ type: String, default: null })
  correlationId!: string | null;

  @Prop({ type: String, required: true, default: OUTBOX_STATES.Pending })
  state!: OutboxState;

  @Prop({ type: Number, required: true, default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true })
  availableAt!: Date;

  @Prop({ type: Date, default: null })
  deliveredAt!: Date | null;
}

export type OutboxEventDocument = HydratedDocument<OutboxEventDoc>;
export const OutboxEventSchema = SchemaFactory.createForClass(OutboxEventDoc);
OutboxEventSchema.index({ state: 1, availableAt: 1 });

/**
 * Consumer-side dedupe record.
 *
 * Delivery is at-least-once, so before a consumer's handler runs, the (consumer, eventId) pair
 * is claimed here behind a unique index. A repeated delivery — drain crash, retry after the
 * handler already succeeded — loses the insert race and is skipped instead of handled twice.
 */
@Schema({ collection: 'outbox_deliveries', timestamps: true, versionKey: false })
export class OutboxDeliveryDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true })
  consumer!: string;

  @Prop({ type: String, required: true })
  eventId!: string;

  @Prop({ type: Date, required: true })
  processedAt!: Date;
}

export type OutboxDeliveryDocument = HydratedDocument<OutboxDeliveryDoc>;
export const OutboxDeliverySchema = SchemaFactory.createForClass(OutboxDeliveryDoc);
OutboxDeliverySchema.index({ consumer: 1, eventId: 1 }, { unique: true });
