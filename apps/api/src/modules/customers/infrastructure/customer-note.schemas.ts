import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Staff notes on a customer record.
 *
 * Notes are append-only: there is no edit or delete, because a note that can be rewritten
 * after the fact is worthless in a dispute investigation. A correction is a new note.
 */
@Schema({ collection: 'customer_notes', versionKey: false })
export class CustomerNoteDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String, required: true })
  authorId!: string;

  @Prop({ type: String, required: true })
  authorName!: string;

  @Prop({ type: Boolean, required: true, default: false })
  pinned!: boolean;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type CustomerNoteDocument = HydratedDocument<CustomerNoteDoc>;
export const CustomerNoteSchema = SchemaFactory.createForClass(CustomerNoteDoc);
CustomerNoteSchema.index({ customerId: 1, pinned: -1, createdAt: -1 });
