import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * A biller linked to a customer.
 *
 * The autopay rule is stored flat rather than as a nested sub-document: it is read on every
 * end-of-day sweep and queried on two of its fields, and a flat shape indexes without the
 * `autopay.enabled` path gymnastics. The mapper reassembles the nested contract shape.
 *
 * `outstandingMinorUnits` and `dueOn` are a *cache* of the last balance enquiry, stamped with the
 * cycle they belong to. They are re-fetched when the month turns over rather than trusted forever,
 * because a stale balance is how autopay pays last month's bill twice.
 */
@Schema({ collection: 'linked_bills', timestamps: true, versionKey: false })
export class LinkedBillDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  billerId!: string;

  @Prop({ type: String, required: true })
  customerReference!: string;

  @Prop({ type: String, default: null })
  nickname!: string | null;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, default: null })
  outstandingMinorUnits!: number | null;

  @Prop({ type: String, default: null, index: true })
  dueOn!: string | null;

  /** The `YYYY-MM` cycle the cached balance was fetched for. */
  @Prop({ type: String, default: null })
  enquiryCycle!: string | null;

  @Prop({ type: Date, default: null })
  enquiredAt!: Date | null;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  autopayEnabled!: boolean;

  @Prop({ type: String, default: null })
  autopayFromAccountId!: string | null;

  @Prop({ type: String, default: 'full_balance' })
  autopayStrategy!: string;

  @Prop({ type: Number, default: null })
  autopayFixedMinorUnits!: number | null;

  @Prop({ type: Number, required: true, default: 2 })
  autopayDaysBeforeDue!: number;

  @Prop({ type: Number, default: null })
  autopayCapMinorUnits!: number | null;

  /** The due date autopay last fired for, so one due date is never paid twice. */
  @Prop({ type: String, default: null })
  autopayLastDueOn!: string | null;

  @Prop({ type: Date, default: null })
  lastPaidAt!: Date | null;

  @Prop({ type: Number, default: null })
  lastPaidMinorUnits!: number | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type LinkedBillDocument = HydratedDocument<LinkedBillDoc>;
export const LinkedBillSchema = SchemaFactory.createForClass(LinkedBillDoc);

// One customer cannot link the same reference at the same biller twice — that is a double payment
// waiting to happen, and the index refuses it rather than relying on the read-then-write check.
LinkedBillSchema.index(
  { customerId: 1, billerId: 1, customerReference: 1 },
  { unique: true, name: 'linked_bill_identity' },
);
LinkedBillSchema.index({ customerId: 1, createdAt: -1 });
LinkedBillSchema.index({ autopayEnabled: 1, dueOn: 1 });
