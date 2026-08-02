import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * A break quote the customer has been shown.
 *
 * Persisted because a price that is quoted must be honoured: the customer confirms against the
 * figures on their screen, not against whatever the maths returns a few seconds later.
 */
export interface BreakQuoteRecord {
  accruedInterestMinorUnits: number;
  penaltyMinorUnits: number;
  netProceedsMinorUnits: number;
  interestForfeitedMinorUnits: number;
  quotedOn: string;
  expiresAt: Date;
}

/**
 * A term deposit.
 *
 * The money itself lives on a dedicated `fixed_deposit` account (`accountId`); this document
 * records only the contract — principal, rate, dates and instructions. `interestPaidMinorUnits`
 * is not a balance: it is the running total of interest *already posted to the ledger*, and it
 * exists so the daily accrual can post the difference between what has been earned and what has
 * been paid without ever double-crediting a day.
 */
@Schema({ collection: 'term_deposits', timestamps: true, versionKey: false })
export class TermDepositDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** The `fixed_deposit` account holding the principal. */
  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  /** Where the principal came from, and where it returns by default. */
  @Prop({ type: String, required: true })
  fundingAccountId!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: Number, required: true })
  principalMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  rate!: number;

  @Prop({ type: Number, required: true })
  termMonths!: number;

  @Prop({ type: String, required: true })
  openedOn!: string;

  @Prop({ type: String, required: true, index: true })
  maturesOn!: string;

  @Prop({ type: String, required: true })
  maturityInstruction!: string;

  @Prop({ type: String, default: null })
  rolloverAccountId!: string | null;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  /** Interest already credited to the deposit account by the accrual job. */
  @Prop({ type: Number, required: true, default: 0 })
  interestPaidMinorUnits!: number;

  /** The date interest has been posted up to. Never moves backwards. */
  @Prop({ type: String, required: true })
  accruedTo!: string;

  @Prop({ type: Object, default: null })
  breakQuote!: BreakQuoteRecord | null;

  /** Set when this deposit was created by rolling another one over. */
  @Prop({ type: String, default: null })
  rolledFromDepositId!: string | null;

  @Prop({ type: Date, required: true })
  openedAt!: Date;

  @Prop({ type: Date, default: null })
  maturedAt!: Date | null;

  @Prop({ type: Date, default: null })
  brokenAt!: Date | null;
}

export type TermDepositDocument = HydratedDocument<TermDepositDoc>;
export const TermDepositSchema = SchemaFactory.createForClass(TermDepositDoc);
TermDepositSchema.index({ customerId: 1, status: 1, openedAt: -1 });
TermDepositSchema.index({ status: 1, maturesOn: 1 });
