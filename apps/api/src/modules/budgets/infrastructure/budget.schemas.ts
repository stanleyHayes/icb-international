import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * One spending limit per (customer, category). The limit is stored in integer minor units
 * (N1); the month's spend is never stored — it is derived from the ledger on every read, so
 * a budget can never disagree with the transactions the customer sees.
 */
@Schema({ collection: 'budgets', timestamps: true, versionKey: false })
export class BudgetDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  category!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true })
  limitMinorUnits!: number;
}
export type BudgetDocument = HydratedDocument<BudgetDoc>;
export const BudgetSchema = SchemaFactory.createForClass(BudgetDoc);
BudgetSchema.index({ customerId: 1, category: 1 }, { unique: true });
