import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import type { RuleParameters } from '../domain/rules/rule.types.js';

/**
 * Rule configuration, decision thresholds and per-customer behavioural baselines.
 *
 * All three are *state the fraud team owns*, not code. A rule row survives redeploys, a threshold
 * change takes effect on the next assessment, and the profile is what makes "new device" and
 * "first payment to this beneficiary" answerable at all.
 */

@Schema({ collection: 'risk_rules', timestamps: true, versionKey: false })
export class RiskRuleDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** Stable identity across environments; the seed upserts on this, never on `_id`. */
  @Prop({ type: String, required: true, unique: true, index: true })
  code!: string;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: Boolean, required: true, default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Number, required: true })
  weight!: number;

  @Prop({ type: Object, required: true, default: {} })
  parameters!: RuleParameters;

  /** Who last touched this rule, and why. Fraud configuration is an audited surface. */
  @Prop({ type: String, default: null })
  updatedBy!: string | null;

  @Prop({ type: String, default: null })
  lastChangeReason!: string | null;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type RiskRuleDocument = HydratedDocument<RiskRuleDoc>;
export const RiskRuleSchema = SchemaFactory.createForClass(RiskRuleDoc);

/** Singleton row. `key` exists so the document is addressable without hard-coding an `_id`. */
export const DECISION_THRESHOLD_KEY = 'decision_thresholds';

@Schema({ collection: 'risk_settings', timestamps: true, versionKey: false })
export class RiskSettingsDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  key!: string;

  @Prop({ type: Number, required: true })
  challengeAt!: number;

  @Prop({ type: Number, required: true })
  reviewAt!: number;

  @Prop({ type: Number, required: true })
  blockAt!: number;

  @Prop({ type: String, default: null })
  updatedBy!: string | null;
}

export type RiskSettingsDocument = HydratedDocument<RiskSettingsDoc>;
export const RiskSettingsSchema = SchemaFactory.createForClass(RiskSettingsDoc);

/**
 * What "normal" looks like for one customer.
 *
 * Grown from assessments rather than configured: every event the engine sees adds its device,
 * country and beneficiary. A rule can therefore ask "has this been seen before?" without each
 * rule inventing its own memory.
 */
@Schema({ collection: 'risk_profiles', timestamps: true, versionKey: false })
export class RiskProfileDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  customerId!: string;

  @Prop({ type: [String], required: true, default: [] })
  knownDeviceIds!: string[];

  @Prop({ type: [String], required: true, default: [] })
  knownBeneficiaryIds!: string[];

  @Prop({ type: String, default: null })
  lastCountryCode!: string | null;

  @Prop({ type: Date, default: null })
  lastCountryAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastAssessedAt!: Date | null;

  @Prop({ type: Number, required: true, default: 0 })
  assessmentCount!: number;
}

export type RiskProfileDocument = HydratedDocument<RiskProfileDoc>;
export const RiskProfileSchema = SchemaFactory.createForClass(RiskProfileDoc);
