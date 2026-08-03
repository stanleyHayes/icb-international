import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/** A saved set of transfer terms the customer can re-run in one tap. */
@Schema({ collection: 'transfer_templates', timestamps: true, versionKey: false })
export class TransferTemplateDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  fromAccountId!: string;

  @Prop({ type: Object, required: true })
  destination!: Record<string, unknown>;

  @Prop({ type: Number, default: null })
  amountMinorUnits!: number | null;

  @Prop({ type: String, default: null })
  currency!: string | null;

  @Prop({ type: String, default: null })
  reference!: string | null;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Number, required: true, default: 0 })
  useCount!: number;
}

export type TransferTemplateDocument = HydratedDocument<TransferTemplateDoc>;
export const TransferTemplateSchema = SchemaFactory.createForClass(TransferTemplateDoc);
TransferTemplateSchema.index({ customerId: 1, name: 1 }, { unique: true });
