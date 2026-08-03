import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

@Schema({ _id: false })
export class FeeLineEmb {
  @Prop({ type: String, required: true })
  code!: string;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: Number, required: true })
  minorUnits!: number;
}

@Schema({ _id: false })
export class FxEmb {
  @Prop({ type: Number, required: true })
  fromMinorUnits!: number;

  @Prop({ type: String, required: true })
  fromCurrency!: string;

  @Prop({ type: Number, required: true })
  toMinorUnits!: number;

  @Prop({ type: String, required: true })
  toCurrency!: string;

  @Prop({ type: Number, required: true })
  rate!: number;

  @Prop({ type: Number, required: true, default: 0 })
  spreadBps!: number;
}

@Schema({ _id: false })
export class ScheduleEmb {
  @Prop({ type: String, default: null })
  rrule!: string | null;

  @Prop({ type: String, required: true })
  startsOn!: string;

  @Prop({ type: String, default: null })
  endsOn!: string | null;

  @Prop({ type: Number, default: null })
  maxOccurrences!: number | null;
}

@Schema({ _id: false })
export class TimelineEmb {
  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ type: String, required: true })
  status!: string;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: String, default: null })
  detail!: string | null;
}

/**
 * A customer-facing money movement.
 *
 * The first block of fields is the settlement contract with the end-of-day batch — the rail
 * settlement step reads `status`, `estimatedArrival`, `creditMinorUnits`, `currency`,
 * `reference` and `transactionId`, so those names and meanings are fixed. Everything after it is
 * the rebuilt pipeline's state: quote terms, fees, FX, schedule and the customer-visible
 * timeline.
 */
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

  @Prop({ type: String, default: null })
  creditCurrency!: string | null;

  @Prop({ type: Number, required: true, default: 0 })
  feeMinorUnits!: number;

  @Prop({ type: [FeeLineEmb], default: [] })
  feeBreakdown!: FeeLineEmb[];

  @Prop({ type: FxEmb, default: null })
  fx!: FxEmb | null;

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

  @Prop({ type: String, default: null })
  railReference!: string | null;

  @Prop({ type: Date, required: true })
  estimatedArrival!: Date;

  /** When the transfer runs — now for immediate sends, a future instant for scheduled ones. */
  @Prop({ type: Date, default: null, index: true })
  executeAt!: Date | null;

  @Prop({ type: ScheduleEmb, default: null })
  schedule!: ScheduleEmb | null;

  @Prop({ type: String, default: null, index: true })
  standingOrderId!: string | null;

  @Prop({ type: Date, default: null })
  nextOccurrenceAt!: Date | null;

  @Prop({ type: Boolean, required: true, default: false })
  recurring!: boolean;

  @Prop({ type: [TimelineEmb], default: [] })
  timeline!: TimelineEmb[];

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
TransferSchema.index({ status: 1, executeAt: 1 });
