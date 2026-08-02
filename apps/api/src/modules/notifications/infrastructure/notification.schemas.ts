import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * The delivery log.
 *
 * One document per event *per channel*, not one per event: the same transfer produces an in-app
 * row, an email row and a push row, each with its own state. That is the only shape that answers
 * the question support actually gets — "I never got the email" — because the email's own state,
 * provider id and failure reason are right there next to the in-app row the customer did see.
 *
 * Rows are never deleted and states only move forward (see `STATE_RANK`), so a late-arriving
 * webhook cannot rewrite history backwards.
 */
@Schema({ collection: 'notifications', timestamps: true, versionKey: false })
export class NotificationDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  event!: string;

  @Prop({ type: String, required: true, index: true })
  channel!: string;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String, required: true, index: true })
  state!: string;

  @Prop({ type: String, default: null })
  actionUrl!: string | null;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  /** The address or number the message went to. Null for in-app, which has no destination. */
  @Prop({ type: String, default: null })
  recipient!: string | null;

  /** Which transport produced `providerMessageId` — `resend`, `recording`, or a simulated rail. */
  @Prop({ type: String, default: null })
  providerName!: string | null;

  /**
   * Indexed and sparse: the Resend webhook's only handle on this row is the message id, and it
   * arrives on a public endpoint, so that lookup has to be a single indexed hit.
   */
  @Prop({ type: String, default: null, index: true, sparse: true })
  providerMessageId!: string | null;

  /** The facts the template was rendered from. Kept so a message can be explained or re-rendered. */
  @Prop({ type: Object, default: {} })
  payload!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  failureReason!: string | null;

  @Prop({ type: Number, required: true, default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, default: null })
  sentAt!: Date | null;

  @Prop({ type: Date, default: null })
  deliveredAt!: Date | null;
}

export type NotificationDocument = HydratedDocument<NotificationDoc>;
export const NotificationSchema = SchemaFactory.createForClass(NotificationDoc);

// The customer's own feed, newest first — the query behind `GET /notifications`.
NotificationSchema.index({ customerId: 1, createdAt: -1 });
// The unread badge and `unreadOnly=true`, without scanning the feed.
NotificationSchema.index({ customerId: 1, readAt: 1, createdAt: -1 });
// Operational: "what bounced today?" across every customer.
NotificationSchema.index({ state: 1, createdAt: -1 });
