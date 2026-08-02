import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * One attempt to pay a bill.
 *
 * The record outlives its outcome: a failed payment keeps its `transactionId` *and* gains a
 * `reversalTransactionId`, because both postings are real and both appear on the statement. The
 * biller's own `billerReference` is stored separately from ICB's — it is the identifier the
 * customer quotes to the biller, and losing it makes a dispute unanswerable.
 */
@Schema({ collection: 'bill_payments', timestamps: true, versionKey: false })
export class BillPaymentDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  billId!: string;

  @Prop({ type: String, required: true, index: true })
  billerId!: string;

  /** Denormalised so payment history renders without a join, and survives a biller rename. */
  @Prop({ type: String, required: true })
  billerName!: string;

  @Prop({ type: String, required: true })
  customerReference!: string;

  @Prop({ type: String, default: null })
  fromAccountId!: string | null;

  @Prop({ type: Number, required: true })
  amountMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  feeMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, default: null })
  billerReference!: string | null;

  @Prop({ type: String, default: null })
  failureReason!: string | null;

  @Prop({ type: String, default: null, index: true })
  transactionId!: string | null;

  @Prop({ type: String, default: null })
  reversalTransactionId!: string | null;

  @Prop({ type: Date, default: null, index: true })
  scheduledFor!: Date | null;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  /** ISO calendar date, so a history filter is a string range rather than a timezone argument. */
  @Prop({ type: String, required: true, index: true })
  valueDate!: string;

  @Prop({ type: String, required: true, default: 'customer' })
  initiatedBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type BillPaymentDocument = HydratedDocument<BillPaymentDoc>;
export const BillPaymentSchema = SchemaFactory.createForClass(BillPaymentDoc);
BillPaymentSchema.index({ customerId: 1, _id: -1 });
BillPaymentSchema.index({ billId: 1, _id: -1 });
BillPaymentSchema.index({ status: 1, scheduledFor: 1 });
