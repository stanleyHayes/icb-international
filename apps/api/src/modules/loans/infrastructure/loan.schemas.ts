import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Booked loans.
 *
 * The bank's *asset* lives in the ledger at GL 1100; what lives here is the servicing state of
 * one contract — which instalment is next, what has been paid against it, and how much principal
 * and interest remain. Those counters are only ever moved inside the same database transaction as
 * the ledger posting that justifies them, so the two can never disagree.
 *
 * There is no float anywhere in this file, and no balance is ever assigned from a computed total:
 * every counter is decremented by exactly the amount a posting moved.
 */

@Schema({ _id: false })
export class InstalmentSub {
  @Prop({ type: Number, required: true })
  number!: number;

  @Prop({ type: String, required: true })
  dueOn!: string;

  @Prop({ type: Number, required: true })
  instalmentMinorUnits!: number;

  @Prop({ type: Number, required: true })
  principalMinorUnits!: number;

  @Prop({ type: Number, required: true })
  interestMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  feesMinorUnits!: number;

  @Prop({ type: Number, required: true })
  openingBalanceMinorUnits!: number;

  @Prop({ type: Number, required: true })
  closingBalanceMinorUnits!: number;

  @Prop({ type: String, required: true, default: 'scheduled' })
  status!: string;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;

  @Prop({ type: Number, required: true, default: 0 })
  paidMinorUnits!: number;
}

export const InstalmentSubSchema = SchemaFactory.createForClass(InstalmentSub);

@Schema({ collection: 'loans', versionKey: false })
export class LoanDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  applicationId!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** The customer account the loan is drawn down to and serviced from. */
  @Prop({ type: String, required: true })
  accountId!: string;

  @Prop({ type: String, required: true })
  repaymentAccountId!: string;

  @Prop({ type: String, required: true, index: true })
  productCode!: string;

  @Prop({ type: String, required: true })
  productName!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  principalMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  outstandingPrincipalMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  accruedInterestMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  feesOutstandingMinorUnits!: number;

  @Prop({ type: Number, required: true })
  rate!: number;

  @Prop({ type: Number, required: true })
  termMonths!: number;

  @Prop({ type: String, required: true })
  frequency!: string;

  @Prop({ type: Number, required: true })
  instalmentMinorUnits!: number;

  @Prop({ type: [InstalmentSubSchema], default: [] })
  schedule!: InstalmentSub[];

  /** ISO date interest was last brought up to. Accrual runs from here to the settlement date. */
  @Prop({ type: String, default: null })
  lastAccrualOn!: string | null;

  @Prop({ type: String, required: true })
  maturesOn!: string;

  @Prop({ type: Date, default: null })
  disbursedAt!: Date | null;

  @Prop({ type: String, default: null })
  disbursementTransactionId!: string | null;

  @Prop({ type: Date, default: null })
  settledAt!: Date | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type LoanDocument = HydratedDocument<LoanDoc>;
export const LoanSchema = SchemaFactory.createForClass(LoanDoc);
LoanSchema.index({ customerId: 1, createdAt: -1 });
LoanSchema.index({ status: 1, maturesOn: 1 });
