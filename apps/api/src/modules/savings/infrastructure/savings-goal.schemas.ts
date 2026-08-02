import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/** A standing instruction to move money into the goal on a schedule. */
export interface AutoContributionRecord {
  amountMinorUnits: number;
  frequency: string;
  nextRunOn: string;
  fromAccountId: string;
}

/**
 * A savings goal.
 *
 * Note what is *not* stored: how much has been saved. That total is the sum of the goal's
 * contributions, each of which carries the id of the ledger transaction that moved the money.
 * A counter here would be a second, unreconciled record of a balance — the exact thing the
 * ledger exists to prevent (agent_plan.md N4).
 */
@Schema({ collection: 'savings_goals', timestamps: true, versionKey: false })
export class SavingsGoalDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** The account the goal's money is held in. */
  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  icon!: string;

  @Prop({ type: Number, required: true })
  targetMinorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, default: null })
  targetDate!: string | null;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  roundUpsEnabled!: boolean;

  @Prop({ type: Object, default: null })
  autoContribution!: AutoContributionRecord | null;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, default: null })
  achievedAt!: Date | null;
}

export type SavingsGoalDocument = HydratedDocument<SavingsGoalDoc>;
export const SavingsGoalSchema = SchemaFactory.createForClass(SavingsGoalDoc);
SavingsGoalSchema.index({ customerId: 1, status: 1, createdAt: 1 });
SavingsGoalSchema.index({ customerId: 1, roundUpsEnabled: 1, status: 1 });

/**
 * One movement of money into a goal.
 *
 * Immutable and always written in the same database transaction as the posting it describes, so
 * `transactionId` can always be resolved to a balanced pair of ledger entries. This collection —
 * not a field on the goal — is the source of truth for "how much have I saved?".
 */
@Schema({ collection: 'savings_contributions', timestamps: true, versionKey: false })
export class SavingsContributionDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  goalId!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true })
  fromAccountId!: string;

  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  /** `manual`, `round_up` or `auto` — how the money came to be here. */
  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true, index: true })
  transactionId!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;
}

export type SavingsContributionDocument = HydratedDocument<SavingsContributionDoc>;
export const SavingsContributionSchema = SchemaFactory.createForClass(SavingsContributionDoc);
SavingsContributionSchema.index({ goalId: 1, createdAt: -1 });
