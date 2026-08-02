import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * The biller directory.
 *
 * `code` rather than `_id` is the stable identity: the directory is re-seeded on every boot with
 * an upsert on the code, so a restart refreshes names and fees without minting new identifiers
 * and orphaning every bill a customer has already linked.
 */
@Schema({ collection: 'billers', timestamps: true, versionKey: false })
export class BillerDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  code!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, index: true })
  category!: string;

  @Prop({ type: String, default: null })
  logoUrl!: string | null;

  @Prop({ type: String, required: true })
  referenceLabel!: string;

  @Prop({ type: String, default: null })
  referencePattern!: string | null;

  @Prop({ type: Boolean, required: true, default: false })
  supportsBalanceEnquiry!: boolean;

  @Prop({ type: Number, default: null })
  minimumAmountMinorUnits!: number | null;

  /** Flat convenience fee, credited to fee income (4000) on the same transaction as the payment. */
  @Prop({ type: Number, required: true, default: 0 })
  feeMinorUnits!: number;

  /** Retunable without a deploy: an operator can widen the failure rate to exercise reversals. */
  @Prop({ type: Number, required: true, default: 0 })
  failureRate!: number;

  @Prop({ type: Number, required: true, default: 0 })
  typicalBillMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Boolean, required: true, default: true, index: true })
  active!: boolean;
}

export type BillerDocument = HydratedDocument<BillerDoc>;
export const BillerSchema = SchemaFactory.createForClass(BillerDoc);
BillerSchema.index({ active: 1, category: 1 });
BillerSchema.index({ name: 'text' });
