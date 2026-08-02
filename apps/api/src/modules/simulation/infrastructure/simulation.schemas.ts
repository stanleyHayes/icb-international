import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Simulation control persistence.
 *
 * The clock offset lives here rather than only in memory because a bank is more than one
 * process: the API, the queue workers and the seed CLI must all agree on what "now" is, or an
 * accrual runs twice and a statement covers the wrong month.
 */

/** One row, always. The simulation has exactly one state. */
export const SIM_STATE_ID = 'sim-state-singleton';

/** A rail profile as stored. Mirrors the contract shape with mutable, Mongo-friendly fields. */
export class StoredRailProfile {
  rail!: string;
  enabled!: boolean;
  minLatencyMs!: number;
  maxLatencyMs!: number;
  failureRate!: number;
  failureCodes!: { code: string; label: string; weight: number }[];
  settlementDelayHours!: number;
  cutOffTime!: string | null;
}

@Schema({ collection: 'sim_state', timestamps: true, versionKey: false })
export class SimStateDoc {
  @Prop({ type: String, default: SIM_STATE_ID })
  _id!: string;

  /** Milliseconds added to real time. Restored into ClockService on boot. */
  @Prop({ type: Number, required: true, default: 0 })
  clockOffsetMs!: number;

  @Prop({ type: Boolean, required: true, default: false })
  clockFrozen!: boolean;

  @Prop({ type: [Object], default: [] })
  railProfiles!: StoredRailProfile[];

  @Prop({ type: Boolean, required: true, default: false })
  chaosEnabled!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  chaosDatabaseLatencyMs!: number;

  @Prop({ type: Number, required: true, default: 0 })
  chaosRandomFailureRate!: number;

  @Prop({ type: String, default: null })
  activeScenarioRunId!: string | null;

  @Prop({ type: Date, default: null })
  seededAt!: Date | null;
}

export type SimStateDocument = HydratedDocument<SimStateDoc>;
export const SimStateSchema = SchemaFactory.createForClass(SimStateDoc);

/**
 * One execution of a named scenario.
 *
 * Kept as a record rather than a log line because a scenario is a claim about the bank — "this
 * seed produced these 400 events" — and the claim has to survive a restart to be checkable.
 */
@Schema({ collection: 'scenario_runs', versionKey: false })
export class ScenarioRunDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  name!: string;

  @Prop({ type: String, required: true })
  seed!: string;

  @Prop({ type: String, required: true })
  intensity!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: Number, required: true, default: 0 })
  eventsGenerated!: number;

  @Prop({ type: Date, required: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: String, default: null })
  error!: string | null;
}

export type ScenarioRunDocument = HydratedDocument<ScenarioRunDoc>;
export const ScenarioRunSchema = SchemaFactory.createForClass(ScenarioRunDoc);
ScenarioRunSchema.index({ startedAt: -1 });

/**
 * Runtime feature flags.
 *
 * Deliberately not cached in this module: a flag an operator flips must take effect on the next
 * request, and a stale toggle during a demo is indistinguishable from a bug.
 */
@Schema({ collection: 'feature_flags', versionKey: false })
export class SimFeatureFlagDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  key!: string;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: Boolean, required: true, default: false })
  enabled!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  rolloutPercentage!: number;

  @Prop({ type: String, required: true, default: 'all' })
  audience!: string;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type SimFeatureFlagDocument = HydratedDocument<SimFeatureFlagDoc>;
export const SimFeatureFlagSchema = SchemaFactory.createForClass(SimFeatureFlagDoc);
