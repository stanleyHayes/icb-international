import type { LoanApplication, LoanDecision } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Loan applications.
 *
 * Mongoose's own `timestamps` option is deliberately *not* used here: it stamps documents from
 * the host clock, and a bank whose operator can advance time a month must have its application
 * ages move with it. `createdAt` and `updatedAt` are written from ClockService instead.
 *
 * The decision is stored in its contract shape because it is an immutable snapshot of an
 * underwriting event — re-deriving it later from a changed scorecard would silently rewrite
 * history. The offer is stored in minor units because it mutates (it gets accepted).
 */

/** The offer as persisted. Mapped to the contract at the edge. */
export interface StoredOffer {
  amountMinorUnits: number;
  rate: number;
  instalmentMinorUnits: number;
  expiresAt: Date;
  acceptedAt: Date | null;
}

export type StoredApplicationDocument = LoanApplication['documents'][number];

@Schema({ collection: 'loan_applications', versionKey: false })
export class LoanApplicationDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  productCode!: string;

  @Prop({ type: String, required: true })
  productName!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: Number, required: true })
  requestedMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  termMonths!: number;

  @Prop({ type: String, required: true })
  frequency!: string;

  @Prop({ type: String, required: true })
  purpose!: string;

  @Prop({ type: String, default: null })
  purposeDetail!: string | null;

  @Prop({ type: String, required: true })
  disbursementAccountId!: string;

  @Prop({ type: String, required: true })
  repaymentAccountId!: string;

  @Prop({ type: Number, required: true })
  declaredMonthlyIncomeMinorUnits!: number;

  @Prop({ type: Number, required: true })
  declaredMonthlyExpensesMinorUnits!: number;

  @Prop({ type: Number, required: true })
  existingCommitmentsMinorUnits!: number;

  @Prop({ type: [Object], default: [] })
  documents!: StoredApplicationDocument[];

  @Prop({ type: Object, default: null })
  decision!: LoanDecision | null;

  @Prop({ type: Object, default: null })
  offer!: StoredOffer | null;

  /** Set once the accepted offer has been booked as a loan. */
  @Prop({ type: String, default: null, index: true })
  loanId!: string | null;

  @Prop({ type: Date, default: null })
  submittedAt!: Date | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type LoanApplicationDocument = HydratedDocument<LoanApplicationDoc>;
export const LoanApplicationSchema = SchemaFactory.createForClass(LoanApplicationDoc);
LoanApplicationSchema.index({ customerId: 1, createdAt: -1 });
LoanApplicationSchema.index({ status: 1, submittedAt: 1 });
