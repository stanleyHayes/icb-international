import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Customer accounts.
 *
 * Note what is *not* here: a balance. Balances live in `account_balances` and are written only
 * by LedgerService (agent_plan.md N4). Putting a mutable balance field on this document is the
 * single easiest way to corrupt a bank, so the field simply does not exist.
 */
@Schema({ collection: 'accounts', timestamps: true, versionKey: false })
export class AccountDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  productCode!: string;

  @Prop({ type: String, required: true })
  productName!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  number!: string;

  @Prop({ type: String, required: true, unique: true })
  iban!: string;

  @Prop({ type: String, required: true })
  bic!: string;

  @Prop({ type: String, required: true })
  sortCode!: string;

  @Prop({ type: String, required: true, index: true })
  currency!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, default: null })
  nickname!: string | null;

  @Prop({ type: Boolean, required: true, default: false })
  primary!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  overdraftMinorUnits!: number;

  @Prop({ type: Number, default: null })
  interestRate!: number | null;

  @Prop({ type: Number, default: null })
  minimumBalanceMinorUnits!: number | null;

  @Prop({ type: Number, default: null })
  monthlyFeeMinorUnits!: number | null;

  @Prop({ type: Number, required: true, default: 1 })
  statementDay!: number;

  @Prop({ type: Date, default: null })
  lastStatementAt!: Date | null;

  @Prop({ type: Date, required: true })
  openedAt!: Date;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;

  @Prop({ type: String, default: null })
  closureReason!: string | null;
}

export type AccountDocument = HydratedDocument<AccountDoc>;
export const AccountSchema = SchemaFactory.createForClass(AccountDoc);
AccountSchema.index({ customerId: 1, status: 1 });
AccountSchema.index({ customerId: 1, primary: -1, openedAt: 1 });
