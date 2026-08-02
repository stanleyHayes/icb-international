import type { FiredRule } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Assessments and the cases they raise.
 *
 * Every assessment is stored, not just the ones that stopped a payment. The allowed ones are the
 * control group: without them nobody can answer "how often does this rule fire on good traffic?",
 * and a rule nobody can measure is a rule nobody dares tune.
 *
 * `firedRules` is embedded rather than referenced because it must never change after the fact.
 * A rule re-weighted next month does not retroactively rewrite why a payment was blocked today.
 */
@Schema({ collection: 'risk_assessments', timestamps: true, versionKey: false })
export class RiskAssessmentDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  subjectType!: string;

  @Prop({ type: String, required: true, index: true })
  subjectId!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: Number, required: true, index: true })
  score!: number;

  @Prop({ type: String, required: true, index: true })
  decision!: string;

  @Prop({ type: [Object], required: true, default: [] })
  firedRules!: FiredRule[];

  @Prop({ type: String, required: true })
  narrative!: string;

  @Prop({ type: Number, required: true })
  amountMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: Number, required: true, default: 0 })
  rulesConsidered!: number;

  @Prop({ type: Date, required: true, index: true })
  assessedAt!: Date;
}

export type RiskAssessmentDocument = HydratedDocument<RiskAssessmentDoc>;
export const RiskAssessmentSchema = SchemaFactory.createForClass(RiskAssessmentDoc);
RiskAssessmentSchema.index({ customerId: 1, assessedAt: -1 });
RiskAssessmentSchema.index({ subjectType: 1, subjectId: 1 });

@Schema({ _id: false })
export class CaseResolutionSub {
  @Prop({ type: String, required: true }) action!: string;
  @Prop({ type: String, required: true }) note!: string;
  @Prop({ type: String, required: true }) by!: string;
  @Prop({ type: Date, required: true }) at!: Date;
}
export const CaseResolutionSubSchema = SchemaFactory.createForClass(CaseResolutionSub);

/**
 * A case is raised only when a human must act — a review or a block. Everything else settles
 * without one, which is what keeps the queue a queue rather than a log.
 */
@Schema({ collection: 'risk_cases', timestamps: true, versionKey: false })
export class RiskCaseDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** Denormalised so the queue renders without a lookup per row. */
  @Prop({ type: String, required: true })
  customerName!: string;

  @Prop({ type: String, required: true, index: true })
  assessmentId!: string;

  @Prop({ type: String, required: true, index: true })
  severity!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, required: true, index: true })
  decision!: string;

  @Prop({ type: Number, default: null })
  amountMinorUnits!: number | null;

  @Prop({ type: String, default: null })
  currency!: string | null;

  @Prop({ type: String, default: null, index: true })
  assignedTo!: string | null;

  @Prop({ type: CaseResolutionSubSchema, default: null })
  resolution!: CaseResolutionSub | null;

  @Prop({ type: Date, required: true, index: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type RiskCaseDocument = HydratedDocument<RiskCaseDoc>;
export const RiskCaseSchema = SchemaFactory.createForClass(RiskCaseDoc);
RiskCaseSchema.index({ status: 1, severity: 1, createdAt: -1 });
RiskCaseSchema.index({ customerId: 1, createdAt: -1 });
