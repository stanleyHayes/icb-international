import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * The watcher's watermark for one dispute.
 *
 * The disputes collection itself is owned by the risk module and stays untouched; this sidecar
 * records how much of each dispute's timeline the watcher has already announced, and whether the
 * SLA breach for it has been raised. Because the watermark and the outbox event are written in
 * one transaction, a crash between sweeps can never announce the same stage twice.
 */
@Schema({ collection: 'dispute_watch_states', timestamps: true, versionKey: false })
export class DisputeWatchDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  disputeId!: string;

  /** Count of timeline entries already announced — the timeline is append-only, so a count is a cursor. */
  @Prop({ type: Number, required: true, default: 0 })
  seenTimelineEntries!: number;

  @Prop({ type: Date, default: null })
  slaAlertedAt!: Date | null;
}

export type DisputeWatchDocument = HydratedDocument<DisputeWatchDoc>;
export const DisputeWatchSchema = SchemaFactory.createForClass(DisputeWatchDoc);
