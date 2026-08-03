import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * A requested transaction export. The record is the idempotency anchor: the unique index on
 * (customer, account, format, window) means asking for the same export twice returns the first
 * one rather than rendering again, so the POST is safe to retry. Bytes are *not* stored — an
 * export is a deterministic function of the ledger over a closed window, so the download
 * route re-renders from the recorded parameters.
 */
@Schema({ collection: 'transaction_exports', timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class TransactionExportDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  accountId!: string;

  @Prop({ type: String, required: true, enum: ['csv', 'ofx', 'pdf', 'json'] })
  format!: string;

  @Prop({ type: String, required: true })
  from!: string;

  @Prop({ type: String, required: true })
  to!: string;

  @Prop({ type: Date, required: true })
  linkExpiresAt!: Date;
}

export type TransactionExportDocument = HydratedDocument<TransactionExportDoc>;
export const TransactionExportSchema = SchemaFactory.createForClass(TransactionExportDoc);
TransactionExportSchema.index(
  { customerId: 1, accountId: 1, format: 1, from: 1, to: 1 },
  { unique: true },
);
