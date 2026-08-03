import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { ScheduleEmb } from './transfer.schemas.js';

export const STANDING_ORDER_STATUSES = ['active', 'paused', 'completed', 'cancelled'] as const;
export type StandingOrderStatus = (typeof STANDING_ORDER_STATUSES)[number];

/**
 * A recurring transfer.
 *
 * The standing order holds the terms; each run materialises as its own transfer document linked
 * by `standingOrderId`, so a single failed run is a failed transfer — not a corrupted series.
 */
@Schema({ collection: 'standing_orders', timestamps: true, versionKey: false })
export class StandingOrderDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  fromAccountId!: string;

  @Prop({ type: Object, required: true })
  destination!: Record<string, unknown>;

  @Prop({ type: Number, required: true })
  amountMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, default: null })
  reference!: string | null;

  @Prop({ type: String, default: null })
  note!: string | null;

  @Prop({ type: ScheduleEmb, required: true })
  schedule!: ScheduleEmb;

  @Prop({ type: Date, default: null, index: true })
  nextRunAt!: Date | null;

  @Prop({ type: String, required: true, default: 'active', index: true })
  status!: StandingOrderStatus;

  @Prop({ type: Number, required: true, default: 0 })
  executedCount!: number;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type StandingOrderDocument = HydratedDocument<StandingOrderDoc>;
export const StandingOrderSchema = SchemaFactory.createForClass(StandingOrderDoc);
StandingOrderSchema.index({ status: 1, nextRunAt: 1 });
