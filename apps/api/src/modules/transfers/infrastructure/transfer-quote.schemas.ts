import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

export const TRANSFER_QUOTE_STATUSES = {
  ISSUED: 'issued',
  REDEEMED: 'redeemed',
  EXPIRED: 'expired',
} as const;

@Schema({ _id: false })
class QuoteAmountEmb {
  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;
}

/**
 * A price commitment for a transfer.
 *
 * Written `issued` and moved on only by redemption, behind a conditional update — the same
 * single-use construction as the FX module's quotes. The signature binds every term the customer
 * was shown, and a TTL index sweeps expired rows so the collection does not grow forever.
 */
@Schema({ collection: 'transfer_quotes', timestamps: true, versionKey: false })
export class TransferQuoteDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  fromAccountId!: string;

  @Prop({ type: Object, required: true })
  destination!: Record<string, unknown>;

  @Prop({ type: String, required: true })
  destinationKey!: string;

  @Prop({ type: String, required: true })
  rail!: string;

  @Prop({ type: QuoteAmountEmb, required: true })
  debit!: QuoteAmountEmb;

  @Prop({ type: QuoteAmountEmb, required: true })
  credit!: QuoteAmountEmb;

  @Prop({ type: Number, required: true, default: 0 })
  feeMinorUnits!: number;

  @Prop({ type: [{ code: String, label: String, minorUnits: Number }], default: [] })
  feeBreakdown!: { code: string; label: string; minorUnits: number }[];

  @Prop({ type: Number, default: null })
  fxRate!: number | null;

  @Prop({ type: Number, default: null })
  fxSpreadBps!: number | null;

  @Prop({ type: Number, default: 0 })
  fxRoundingDelta!: number;

  @Prop({ type: Date, required: true })
  estimatedArrival!: Date;

  @Prop({ type: Date, default: null })
  cutOffAt!: Date | null;

  @Prop({ type: String, required: true })
  status!: string;

  @Prop({ type: String, required: true })
  signature!: string;

  @Prop({ type: Date, required: true })
  issuedAt!: Date;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  redeemedAt!: Date | null;

  @Prop({ type: String, default: null })
  redeemedTransferId!: string | null;
}

export type TransferQuoteDocument = HydratedDocument<TransferQuoteDoc>;
export const TransferQuoteSchema = SchemaFactory.createForClass(TransferQuoteDoc);
// Expired quotes are dead weight; the TTL sweeper removes them a day after they lapse.
TransferQuoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });
