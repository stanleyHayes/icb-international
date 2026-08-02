import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/** A quote is spent exactly once. These are the only three states it can be in. */
export const QUOTE_STATUSES = {
  ISSUED: 'issued',
  REDEEMED: 'redeemed',
  EXPIRED: 'expired',
} as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[keyof typeof QUOTE_STATUSES];

/**
 * The published rate board.
 *
 * A cache, not the source of truth: the authoritative rate is `midRateAt()`, a pure function of
 * the simulated clock. This collection exists so the board can be read, indexed and joined
 * without every consumer re-deriving 210 pairs, and it is refreshed as the clock moves.
 */
@Schema({ collection: 'fx_rates', timestamps: true, versionKey: false })
export class FxRateDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  pair!: string;

  @Prop({ type: String, required: true, index: true })
  base!: string;

  @Prop({ type: String, required: true, index: true })
  quote!: string;

  @Prop({ type: Number, required: true })
  mid!: number;

  @Prop({ type: Number, required: true })
  buy!: number;

  @Prop({ type: Number, required: true })
  sell!: number;

  @Prop({ type: Number, required: true })
  spreadBps!: number;

  @Prop({ type: Number, required: true, default: 0 })
  changePercent24h!: number;

  @Prop({ type: Date, required: true })
  effectiveAt!: Date;
}

/**
 * An issued price commitment.
 *
 * `status` plus a conditional update is what enforces single use — the redemption is a single
 * atomic `findOneAndUpdate` on `{ status: 'issued', expiresAt: { $gt: now } }`, so two concurrent
 * redemptions cannot both win.
 */
@Schema({ collection: 'fx_quotes', timestamps: true, versionKey: false })
export class FxQuoteDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  fromCurrency!: string;

  @Prop({ type: String, required: true })
  toCurrency!: string;

  @Prop({ type: Number, required: true })
  fromMinorUnits!: number;

  @Prop({ type: Number, required: true })
  toMinorUnits!: number;

  @Prop({ type: Number, required: true })
  rate!: number;

  @Prop({ type: Number, required: true })
  midRate!: number;

  @Prop({ type: Number, required: true })
  spreadBps!: number;

  /** Fractional minor units lost or gained to rounding. Not money — a remainder awaiting GL 9000. */
  @Prop({ type: Number, required: true, default: 0 })
  roundingDelta!: number;

  @Prop({ type: String, required: true })
  amountSide!: string;

  @Prop({ type: String, required: true, default: QUOTE_STATUSES.ISSUED, index: true })
  status!: string;

  @Prop({ type: String, required: true })
  signature!: string;

  @Prop({ type: Date, required: true })
  issuedAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  redeemedAt!: Date | null;

  @Prop({ type: String, default: null })
  redeemedTransactionId!: string | null;
}

export type FxRateDocument = HydratedDocument<FxRateDoc>;
export type FxQuoteDocument = HydratedDocument<FxQuoteDoc>;

export const FxRateSchema = SchemaFactory.createForClass(FxRateDoc);
export const FxQuoteSchema = SchemaFactory.createForClass(FxQuoteDoc);

FxRateSchema.index({ base: 1, quote: 1 }, { unique: true });
FxQuoteSchema.index({ customerId: 1, status: 1, expiresAt: -1 });
