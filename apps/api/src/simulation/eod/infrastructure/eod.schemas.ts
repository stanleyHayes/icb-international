import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * End-of-day bookkeeping.
 *
 * Every document here exists to make the pipeline *re-runnable*. An operator will run end-of-day
 * twice — by accident, after a crash, or because they advanced the clock over the same day again
 * — and the second run must charge nothing, accrue nothing, and change nothing. Uniqueness is
 * enforced by the database rather than by a check-then-write, because a check-then-write races.
 */

@Schema({ collection: 'interest_accruals', versionKey: false })
export class InterestAccrualDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  /** ISO date the interest was earned for. One row per account per day, forever. */
  @Prop({ type: String, required: true })
  accrualDate!: string;

  /** `ACT/365` — the day-count convention the figure was derived under. */
  @Prop({ type: String, required: true })
  basis!: string;

  @Prop({ type: Number, required: true })
  balanceMinorUnits!: number;

  @Prop({ type: Number, required: true })
  rate!: number;

  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, default: null })
  postedTransactionId!: string | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type InterestAccrualDocument = HydratedDocument<InterestAccrualDoc>;
export const InterestAccrualSchema = SchemaFactory.createForClass(InterestAccrualDoc);
/** The idempotency guarantee: an account cannot accrue twice for one day. */
InterestAccrualSchema.index({ accountId: 1, accrualDate: 1 }, { unique: true });

@Schema({ collection: 'fee_charges', versionKey: false })
export class FeeChargeDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  /** Billing period, `YYYY-MM`. A monthly fee is charged once per period, not once per run. */
  @Prop({ type: String, required: true })
  period!: string;

  @Prop({ type: String, required: true })
  code!: string;

  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, default: null })
  postedTransactionId!: string | null;

  /** Set when the fee could not be taken — the charge is recorded, not silently dropped. */
  @Prop({ type: String, default: null })
  waivedReason!: string | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type FeeChargeDocument = HydratedDocument<FeeChargeDoc>;
export const FeeChargeSchema = SchemaFactory.createForClass(FeeChargeDoc);
FeeChargeSchema.index({ accountId: 1, period: 1, code: 1 }, { unique: true });

/**
 * The report of one end-of-day run, keyed by the business date it closed.
 *
 * Overwritten on a re-run rather than appended: the question "how did 12 March close?" has one
 * answer, and it is the state of the books after the last run for that date.
 */
@Schema({ collection: 'eod_reports', versionKey: false })
export class EodReportDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  businessDate!: string;

  @Prop({ type: Number, required: true, default: 0 })
  holdsExpired!: number;

  @Prop({ type: Number, required: true, default: 0 })
  transfersSettled!: number;

  @Prop({ type: Number, required: true, default: 0 })
  interestAccruedMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  feesChargedMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true, default: 0 })
  loansAged!: number;

  @Prop({ type: Number, required: true, default: 0 })
  statementsGenerated!: number;

  @Prop({ type: Number, required: true, default: 0 })
  amlAlertsRaised!: number;

  @Prop({ type: Boolean, required: true, default: false })
  ledgerBalanced!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  suspenseZeroed!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  durationMs!: number;

  @Prop({ type: Date, required: true })
  completedAt!: Date;

  @Prop({ type: Number, required: true, default: 0 })
  runCount!: number;
}

export type EodReportDocument = HydratedDocument<EodReportDoc>;
export const EodReportSchema = SchemaFactory.createForClass(EodReportDoc);
