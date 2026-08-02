import type { AssetRef } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Dispute persistence.
 *
 * The timeline is append-only: a stage is added, never rewritten. Chargeback rights turn on who
 * did what and when, so a dispute that can be edited into a different history is a dispute the
 * bank cannot defend at arbitration.
 */

@Schema({ _id: false })
export class DisputeEvidenceSub {
  @Prop({ type: String, required: true }) id!: string;
  @Prop({ type: String, required: true }) label!: string;
  @Prop({ type: Object, required: true }) asset!: AssetRef;
  @Prop({ type: String, required: true }) uploadedBy!: string;
  @Prop({ type: Date, required: true }) uploadedAt!: Date;
}
export const DisputeEvidenceSubSchema = SchemaFactory.createForClass(DisputeEvidenceSub);

@Schema({ _id: false })
export class DisputeTimelineSub {
  @Prop({ type: Date, required: true }) at!: Date;
  @Prop({ type: String, required: true }) stage!: string;
  @Prop({ type: String, required: true }) note!: string;
}
export const DisputeTimelineSubSchema = SchemaFactory.createForClass(DisputeTimelineSub);

/**
 * Provisional credit is real money, so it points at the ledger transaction that moved it. A
 * clawback records its own transaction id rather than deleting anything — both postings stay on
 * the customer's statement, which is the only honest account of what happened.
 */
@Schema({ _id: false })
export class ProvisionalCreditSub {
  @Prop({ type: Number, required: true }) minorUnits!: number;
  @Prop({ type: String, required: true }) currency!: string;
  @Prop({ type: String, required: true }) transactionId!: string;
  @Prop({ type: Date, required: true }) grantedAt!: Date;
  @Prop({ type: String, default: null }) clawbackTransactionId!: string | null;
  @Prop({ type: Date, default: null }) clawedBackAt!: Date | null;
}
export const ProvisionalCreditSubSchema = SchemaFactory.createForClass(ProvisionalCreditSub);

@Schema({ collection: 'disputes', timestamps: true, versionKey: false })
export class DisputeDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  /** One live dispute per transaction; the unique index is what enforces it. */
  @Prop({ type: String, required: true, index: true })
  transactionId!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  customerName!: string;

  /** The customer account the disputed value left, and where any credit lands. */
  @Prop({ type: String, required: true })
  accountId!: string;

  @Prop({ type: Number, required: true })
  amountMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, required: true, index: true })
  reason!: string;

  @Prop({ type: String, required: true })
  detail!: string;

  @Prop({ type: Boolean, required: true, default: false })
  contactedMerchant!: boolean;

  @Prop({ type: String, required: true, index: true })
  stage!: string;

  @Prop({ type: String, default: null, index: true })
  outcome!: string | null;

  @Prop({ type: [DisputeEvidenceSubSchema], default: [] })
  evidence!: DisputeEvidenceSub[];

  @Prop({ type: ProvisionalCreditSubSchema, default: null })
  provisionalCredit!: ProvisionalCreditSub | null;

  @Prop({ type: [DisputeTimelineSubSchema], default: [] })
  timeline!: DisputeTimelineSub[];

  @Prop({ type: Date, required: true, index: true })
  slaDueAt!: Date;

  @Prop({ type: Date, default: null })
  resolvedAt!: Date | null;

  @Prop({ type: String, default: null })
  assignedTo!: string | null;

  @Prop({ type: Date, required: true, index: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type DisputeDocument = HydratedDocument<DisputeDoc>;
export const DisputeSchema = SchemaFactory.createForClass(DisputeDoc);
DisputeSchema.index({ transactionId: 1 }, { unique: true });
DisputeSchema.index({ customerId: 1, createdAt: -1 });
DisputeSchema.index({ stage: 1, slaDueAt: 1 });
