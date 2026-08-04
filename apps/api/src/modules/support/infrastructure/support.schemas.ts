import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Support persistence.
 *
 * Every timestamp the domain reasons about (`lastMessageAt`, `slaDueAt`, `sentAt`, `ratedAt`…)
 * is set from the simulation clock by the services, so these schemas deliberately do not use
 * Mongoose `timestamps` — those write wall-clock time, which time travel cannot move (N8).
 */

@Schema({ _id: false })
export class SatisfactionSub {
  @Prop({ type: Number, required: true }) rating!: number;
  @Prop({ type: String, default: null }) comment!: string | null;
  @Prop({ type: Date, required: true }) ratedAt!: Date;
}
export const SatisfactionSubSchema = SchemaFactory.createForClass(SatisfactionSub);

@Schema({ collection: 'support_tickets', versionKey: false })
export class SupportTicketDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** Human-facing reference, quoted over the phone. Unique. */
  @Prop({ type: String, required: true, unique: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** Denormalised so the staff inbox renders without a lookup per row. */
  @Prop({ type: String, required: true })
  customerName!: string;

  @Prop({ type: String, required: true })
  subject!: string;

  @Prop({ type: String, required: true })
  category!: string;

  @Prop({ type: String, required: true, index: true })
  priority!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, default: null, index: true })
  assignedTo!: string | null;

  @Prop({ type: String, default: null })
  assignedToName!: string | null;

  /** Maintained on every reply so list views never join the messages collection. */
  @Prop({ type: Number, required: true, default: 0 })
  messageCount!: number;

  @Prop({ type: Date, required: true })
  lastMessageAt!: Date;

  @Prop({ type: Date, default: null, index: true })
  slaDueAt!: Date | null;

  @Prop({ type: Date, default: null })
  resolvedAt!: Date | null;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;

  @Prop({ type: SatisfactionSubSchema, default: null })
  satisfaction!: SatisfactionSub | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}
export type SupportTicketDocument = HydratedDocument<SupportTicketDoc>;
export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicketDoc);
SupportTicketSchema.index({ customerId: 1, lastMessageAt: -1 });
SupportTicketSchema.index({ status: 1, slaDueAt: 1 });

@Schema({ collection: 'support_messages', versionKey: false })
export class SupportMessageDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  ticketId!: string;

  /** Copied from the ticket so a customer-side read stays a single ownership-checked query. */
  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, enum: ['customer', 'agent', 'system'] })
  author!: string;

  @Prop({ type: String, required: true })
  authorId!: string;

  @Prop({ type: String, required: true })
  authorName!: string;

  @Prop({ type: String, required: true })
  body!: string;

  /** `AssetRef` objects from `@icb/media`; validated by the request schema on the way in. */
  @Prop({ type: [Object], default: [] })
  attachments!: Record<string, unknown>[];

  @Prop({ type: Date, required: true })
  sentAt!: Date;
}
export type SupportMessageDocument = HydratedDocument<SupportMessageDoc>;
export const SupportMessageSchema = SchemaFactory.createForClass(SupportMessageDoc);
SupportMessageSchema.index({ ticketId: 1, sentAt: 1, _id: 1 });

@Schema({ collection: 'support_macros', versionKey: false })
export class SupportMacroDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true })
  name!: string;

  @Prop({ type: String, required: true, default: 'general' })
  category!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: Number, required: true, default: 0 })
  usageCount!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}
export type SupportMacroDocument = HydratedDocument<SupportMacroDoc>;
export const SupportMacroSchema = SchemaFactory.createForClass(SupportMacroDoc);
SupportMacroSchema.index({ category: 1, name: 1 });

@Schema({ collection: 'support_callbacks', versionKey: false })
export class SupportCallbackDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  customerName!: string;

  @Prop({ type: String, required: true })
  phone!: string;

  @Prop({ type: String, required: true })
  reason!: string;

  @Prop({ type: String, required: true })
  preferredWindow!: string;

  @Prop({ type: String, default: null })
  ticketId!: string | null;

  @Prop({ type: String, required: true, default: 'pending', index: true })
  status!: string;

  @Prop({ type: Date, required: true })
  requestedAt!: Date;

  @Prop({ type: String, default: null })
  handledBy!: string | null;

  @Prop({ type: Date, default: null })
  handledAt!: Date | null;

  @Prop({ type: String, default: null })
  notes!: string | null;
}
export type SupportCallbackDocument = HydratedDocument<SupportCallbackDoc>;
export const SupportCallbackSchema = SchemaFactory.createForClass(SupportCallbackDoc);
SupportCallbackSchema.index({ customerId: 1, requestedAt: -1 });
