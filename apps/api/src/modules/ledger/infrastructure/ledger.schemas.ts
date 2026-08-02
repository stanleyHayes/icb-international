import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Ledger persistence.
 *
 * `ledger_entries` is append-only: no code path updates or deletes an entry. Corrections are new
 * transactions that reverse the original (agent_plan.md N5), which is what makes the audit trail
 * meaningful and the trial balance reconstructible from history alone.
 */

@Schema({ collection: 'ledger_transactions', timestamps: true, versionKey: false })
export class LedgerTransactionDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  type!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: Object, required: true })
  actor!: { kind: string; id: string | null; label: string };

  @Prop({ type: String, required: true, index: true })
  valueDate!: string;

  @Prop({ type: Date, required: true, index: true })
  bookedAt!: Date;

  @Prop({ type: Date, default: null })
  settledAt!: Date | null;

  @Prop({ type: String, default: null, index: true })
  reversesTransactionId!: string | null;

  @Prop({ type: String, default: null, index: true })
  reversedByTransactionId!: string | null;

  @Prop({ type: String, default: null, index: true })
  sourceType!: string | null;

  @Prop({ type: String, default: null, index: true })
  sourceId!: string | null;

  @Prop({ type: String, default: null })
  correlationId!: string | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, string>;
}

export type LedgerTransactionDocument = HydratedDocument<LedgerTransactionDoc>;
export const LedgerTransactionSchema = SchemaFactory.createForClass(LedgerTransactionDoc);
LedgerTransactionSchema.index({ status: 1, bookedAt: -1 });
LedgerTransactionSchema.index({ sourceType: 1, sourceId: 1 });

@Schema({ collection: 'ledger_entries', timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
export class LedgerEntryDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  transactionId!: string;

  @Prop({ type: String, required: true, index: true })
  accountRef!: string;

  @Prop({ type: String, required: true, enum: ['debit', 'credit'] })
  direction!: 'debit' | 'credit';

  /** Integer minor units. Always positive — `direction` carries the sign. */
  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  /** Signed effect on this account's balance, precomputed so aggregations stay simple. */
  @Prop({ type: Number, required: true })
  signedMinorUnits!: number;

  @Prop({ type: String, required: true, index: true })
  valueDate!: string;

  @Prop({ type: Date, required: true, index: true })
  bookedAt!: Date;

  @Prop({ type: Number, required: true })
  sequence!: number;

  @Prop({ type: String, default: null })
  narrative!: string | null;

  @Prop({ type: String, required: true })
  transactionType!: string;

  @Prop({ type: String, required: true })
  transactionStatus!: string;
}

export type LedgerEntryDocument = HydratedDocument<LedgerEntryDoc>;
export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntryDoc);
LedgerEntrySchema.index({ accountRef: 1, bookedAt: -1 });
LedgerEntrySchema.index({ accountRef: 1, valueDate: 1 });
LedgerEntrySchema.index({ transactionId: 1, sequence: 1 }, { unique: true });

@Schema({ collection: 'account_balances', timestamps: true, versionKey: false })
export class AccountBalanceDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  accountRef!: string;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, required: true, enum: ['debit', 'credit'] })
  normalSide!: 'debit' | 'credit';

  /** Sum of posted entries, in the account's natural direction. */
  @Prop({ type: Number, required: true, default: 0 })
  ledgerMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  debitMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  creditMinorUnits!: number;

  /** Total of unreleased holds. Reduces available balance without touching the ledger. */
  @Prop({ type: Number, required: true, default: 0 })
  holdMinorUnits!: number;

  @Prop({ type: Number, required: true, default: 0 })
  overdraftMinorUnits!: number;

  @Prop({ type: Date, required: true })
  asOf!: Date;

  @Prop({ type: Number, required: true, default: 0 })
  entryCount!: number;
}

export type AccountBalanceDocument = HydratedDocument<AccountBalanceDoc>;
export const AccountBalanceSchema = SchemaFactory.createForClass(AccountBalanceDoc);
AccountBalanceSchema.index({ accountRef: 1, currency: 1 }, { unique: true });

@Schema({ collection: 'holds', timestamps: true, versionKey: false })
export class HoldDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  accountRef!: string;

  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, required: true })
  reason!: string;

  @Prop({ type: String, default: null, index: true })
  sourceType!: string | null;

  @Prop({ type: String, default: null, index: true })
  sourceId!: string | null;

  @Prop({ type: Date, required: true })
  placedAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null, index: true })
  releasedAt!: Date | null;

  @Prop({ type: String, default: null })
  releaseReason!: string | null;
}

export type HoldDocument = HydratedDocument<HoldDoc>;
export const HoldSchema = SchemaFactory.createForClass(HoldDoc);
HoldSchema.index({ accountRef: 1, releasedAt: 1 });
HoldSchema.index({ releasedAt: 1, expiresAt: 1 });
