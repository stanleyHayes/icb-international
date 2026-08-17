import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Chat persistence.
 *
 * Like the support module, every timestamp (`lastMessageAt`, `sentAt`, `closedAt`) is written
 * from the simulation clock by the service, so these schemas deliberately do not use Mongoose
 * `timestamps` — those write wall-clock time, which time travel cannot move (N8).
 */

@Schema({ collection: 'chat_conversations', versionKey: false })
export class ChatConversationDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** Null for an anonymous marketing-site visitor. */
  @Prop({ type: String, default: null, index: true })
  customerId!: string | null;

  /** The name the visitor gave, or the customer's display name once linked. */
  @Prop({ type: String, default: null })
  visitorName!: string | null;

  @Prop({ type: String, required: true, default: 'open', index: true })
  status!: string;

  /** The staff member who closed the conversation, when known. */
  @Prop({ type: String, default: null })
  assignedTo!: string | null;

  /** Denormalised so the staff inbox renders without a lookup per row. */
  @Prop({ type: String, default: null })
  lastMessagePreview!: string | null;

  @Prop({ type: Date, default: null })
  lastMessageAt!: Date | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;
}
export type ChatConversationDocument = HydratedDocument<ChatConversationDoc>;
export const ChatConversationSchema = SchemaFactory.createForClass(ChatConversationDoc);
ChatConversationSchema.index({ status: 1, lastMessageAt: -1 });

@Schema({ collection: 'chat_messages', versionKey: false })
export class ChatMessageDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  conversationId!: string;

  @Prop({ type: String, required: true, enum: ['visitor', 'agent', 'system'] })
  author!: string;

  @Prop({ type: String, required: true })
  authorName!: string;

  /** Plain text; the frontends escape on render. Bounded by the request/frame schemas. */
  @Prop({ type: String, required: true, maxlength: 2000 })
  body!: string;

  @Prop({ type: Date, required: true })
  sentAt!: Date;
}
export type ChatMessageDocument = HydratedDocument<ChatMessageDoc>;
export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessageDoc);
ChatMessageSchema.index({ conversationId: 1, sentAt: 1, _id: 1 });
