import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

@Schema({ collection: 'transfers', timestamps: true, versionKey: false })
export class TransferDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  fromAccountId!: string;

  @Prop({ type: Object, required: true })
  destination!: Record<string, unknown>;

  @Prop({ type: String, required: true, index: true })
  rail!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: Number, required: true })
  debitMinorUnits!: number;

  @Prop({ type: Number, required: true })
  creditMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true, default: 0 })
  feeMinorUnits!: number;

  @Prop({ type: String, required: true })
  recipientName!: string;

  @Prop({ type: String, required: true })
  recipientMasked!: string;

  @Prop({ type: String, default: null })
  customerReference!: string | null;

  @Prop({ type: String, default: null })
  note!: string | null;

  @Prop({ type: String, default: null, index: true })
  transactionId!: string | null;

  @Prop({ type: Date, required: true })
  estimatedArrival!: Date;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: String, default: null })
  failureCode!: string | null;

  @Prop({ type: String, default: null })
  failureReason!: string | null;
}

export type TransferDocument = HydratedDocument<TransferDoc>;
export const TransferSchema = SchemaFactory.createForClass(TransferDoc);
TransferSchema.index({ customerId: 1, createdAt: -1 });
TransferSchema.index({ status: 1, estimatedArrival: 1 });
