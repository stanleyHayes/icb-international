import type { AssetRef } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Statements and documents.
 *
 * A statement stores the *figures* it was issued with, not a promise to recompute them. Once a
 * customer has been handed a PDF saying the closing balance was 4,182.30, that number is a fact
 * about what the bank told them, and it must survive a later backdated correction to the ledger.
 * The correction shows up as a new transaction on a later statement, which is how it works on
 * paper too.
 *
 * Neither collection stores a URL. `asset` is a provider-neutral reference; a delivery link is
 * signed per request and expires, so nothing here is a durable way in.
 */

@Schema({ collection: 'statements', timestamps: true, versionKey: false })
export class StatementDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  @Prop({ type: String, required: true })
  accountLabel!: string;

  /** `YYYY-MM`, taken from the start of the window. */
  @Prop({ type: String, required: true, index: true })
  period!: string;

  @Prop({ type: String, required: true })
  from!: string;

  @Prop({ type: String, required: true })
  to!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  openingMinorUnits!: number;

  @Prop({ type: Number, required: true })
  closingMinorUnits!: number;

  @Prop({ type: Number, required: true })
  totalCreditsMinorUnits!: number;

  @Prop({ type: Number, required: true })
  totalDebitsMinorUnits!: number;

  @Prop({ type: Number, required: true })
  transactionCount!: number;

  @Prop({ type: Object, default: null })
  asset!: AssetRef | null;

  /** The `documents` row for the rendered PDF, so the two views never diverge. */
  @Prop({ type: String, default: null, index: true })
  documentId!: string | null;

  @Prop({ type: Date, required: true })
  generatedAt!: Date;
}

export type StatementDocument = HydratedDocument<StatementDoc>;
export const StatementSchema = SchemaFactory.createForClass(StatementDoc);
/** One statement per account per exact window; a repeat request returns the issued one. */
StatementSchema.index({ accountId: 1, from: 1, to: 1 }, { unique: true });
StatementSchema.index({ customerId: 1, generatedAt: -1 });

@Schema({ collection: 'documents', timestamps: true, versionKey: false })
export class BankDocumentDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true })
  title!: string;

  @Prop({ type: String, default: null, index: true })
  accountId!: string | null;

  @Prop({ type: Object, required: true })
  asset!: AssetRef;

  @Prop({ type: Number, required: true })
  sizeBytes!: number;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type BankDocumentDocument = HydratedDocument<BankDocumentDoc>;
export const BankDocumentSchema = SchemaFactory.createForClass(BankDocumentDoc);
BankDocumentSchema.index({ customerId: 1, createdAt: -1 });
BankDocumentSchema.index({ customerId: 1, kind: 1, createdAt: -1 });
