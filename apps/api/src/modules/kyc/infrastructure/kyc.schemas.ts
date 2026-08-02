import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * KYC persistence.
 *
 * A case is the unit of record: documents, check results and the eventual decision all hang off
 * it, so "why is this customer tier 2?" is answered by one document rather than by joining an
 * audit trail. Cases are never deleted and a decided case is never re-decided — a re-application
 * opens a new case, which is what keeps the compliance history intact.
 */

@Schema({ _id: false })
export class KycDocumentSub {
  @Prop({ type: String, required: true }) id!: string;
  @Prop({ type: String, required: true }) type!: string;
  @Prop({ type: Object, required: true }) asset!: Record<string, unknown>;
  @Prop({ type: String, required: true }) status!: string;
  @Prop({ type: String, default: null }) rejectionReason!: string | null;
  @Prop({ type: String, default: null }) documentNumber!: string | null;
  @Prop({ type: String, default: null }) issuingCountry!: string | null;
  @Prop({ type: String, default: null }) expiresOn!: string | null;
  @Prop({ type: Date, required: true }) uploadedAt!: Date;
  @Prop({ type: Date, default: null }) reviewedAt!: Date | null;
}
export const KycDocumentSubSchema = SchemaFactory.createForClass(KycDocumentSub);

@Schema({ _id: false })
export class KycCheckSub {
  @Prop({ type: String, required: true }) kind!: string;
  @Prop({ type: String, required: true }) outcome!: string;
  @Prop({ type: Number, default: null }) score!: number | null;
  @Prop({ type: String, default: null }) detail!: string | null;
  @Prop({ type: Date, default: null }) completedAt!: Date | null;
}
export const KycCheckSubSchema = SchemaFactory.createForClass(KycCheckSub);

@Schema({ _id: false })
export class KycDecisionSub {
  @Prop({ type: String, required: true }) outcome!: string;
  @Prop({ type: String, default: null }) grantedLevel!: string | null;
  @Prop({ type: String, required: true }) reason!: string;
  @Prop({ type: String, required: true }) decidedBy!: string;
  @Prop({ type: Date, required: true }) decidedAt!: Date;
}
export const KycDecisionSubSchema = SchemaFactory.createForClass(KycDecisionSub);

@Schema({ collection: 'kyc_cases', timestamps: true, versionKey: false })
export class KycCaseDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** Denormalised so the review queue renders without a lookup per row. */
  @Prop({ type: String, required: true })
  customerName!: string;

  @Prop({ type: String, required: true, enum: ['individual', 'business'] })
  customerType!: string;

  @Prop({ type: String, required: true, index: true })
  requestedLevel!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: [KycDocumentSubSchema], default: [] })
  documents!: KycDocumentSub[];

  @Prop({ type: [KycCheckSubSchema], default: [] })
  checks!: KycCheckSub[];

  @Prop({ type: String, default: null, index: true })
  riskRating!: string | null;

  @Prop({ type: KycDecisionSubSchema, default: null })
  decision!: KycDecisionSub | null;

  /** The clock the operations team is measured against. Set on submission, never on creation. */
  @Prop({ type: Date, required: true, index: true })
  slaDueAt!: Date;

  @Prop({ type: Date, default: null })
  submittedAt!: Date | null;

  /** The staff member holding the case, if it has been picked up. */
  @Prop({ type: String, default: null, index: true })
  assignedTo!: string | null;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type KycCaseDocument = HydratedDocument<KycCaseDoc>;
export const KycCaseSchema = SchemaFactory.createForClass(KycCaseDoc);
KycCaseSchema.index({ customerId: 1, createdAt: -1 });
KycCaseSchema.index({ status: 1, slaDueAt: 1 });
