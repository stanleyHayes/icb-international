import { z } from 'zod';

import { transferRailSchema } from '../common/enums.js';
import { idSchema, isoDateTimeSchema, moneySchema } from '../common/primitives.js';

/**
 * Simulation control.
 *
 * These endpoints exist so an operator can make a year pass in a second, make a rail fail on
 * demand, or replay a payday. They are `super_admin` only and never exposed to customers — the
 * customer-facing product has no idea it is a simulation.
 */

/**
 * ISO 8601 duration, restricted to the date and time components ICB actually uses.
 * Deliberately simple: a fully general duration grammar is unreadable and this is an operator
 * tool, not a parser for arbitrary third-party input.
 */
export const ISO_DURATION_PATTERN = /^P(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;

export const clockStateSchema = z.object({
  /** What the application believes "now" is. Everything downstream reads this. */
  now: isoDateTimeSchema,
  /** Milliseconds added to real time. Zero means the clock is running true. */
  offsetMs: z.int(),
  frozen: z.boolean(),
  businessDate: z.iso.date(),
  isBusinessDay: z.boolean(),
  nextBusinessDate: z.iso.date(),
});

export const advanceClockRequestSchema = z
  .object({
    /** ISO 8601 duration, e.g. `P30D`, `PT6H`. Mutually exclusive with `to`. */
    duration: z.string().regex(ISO_DURATION_PATTERN).optional(),
    to: isoDateTimeSchema.optional(),
    /** Run the end-of-day pipeline for each business day crossed. */
    runEndOfDay: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.duration) !== Boolean(value.to), {
    error: 'Provide exactly one of duration or to',
  });

export const setClockRequestSchema = z.object({
  to: isoDateTimeSchema.optional(),
  frozen: z.boolean().optional(),
});

/** How a simulated rail behaves. Tunable at runtime so failure paths can be demonstrated. */
export const railProfileSchema = z.object({
  rail: transferRailSchema,
  enabled: z.boolean(),
  minLatencyMs: z.int().nonnegative(),
  maxLatencyMs: z.int().nonnegative(),
  failureRate: z.number().min(0).max(1),
  /** Weighted distribution of return codes when a failure occurs. */
  failureCodes: z.array(z.object({ code: z.string(), label: z.string(), weight: z.number() })),
  settlementDelayHours: z.number().nonnegative(),
  cutOffTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
});

export const updateRailProfileRequestSchema = railProfileSchema.partial().omit({ rail: true });

export const SCENARIO_NAMES = [
  'payday',
  'month_end',
  'fraud_burst',
  'dispute_wave',
  'market_volatility',
  'rail_outage',
  'high_load',
  'dormant_reactivation',
] as const;

export const scenarioNameSchema = z.enum(SCENARIO_NAMES);

export const scenarioSchema = z.object({
  name: scenarioNameSchema,
  label: z.string(),
  description: z.string(),
  estimatedEvents: z.int().nonnegative(),
  affects: z.array(z.string()),
});

export const runScenarioRequestSchema = z.object({
  name: scenarioNameSchema,
  /** Same seed, same outcome. Makes a demo repeatable and a bug reproducible. */
  seed: z.string().max(64).optional(),
  intensity: z.enum(['light', 'normal', 'heavy']).default('normal'),
});

export const scenarioRunSchema = z.object({
  id: idSchema,
  name: scenarioNameSchema,
  seed: z.string(),
  intensity: z.enum(['light', 'normal', 'heavy']),
  status: z.enum(['running', 'completed', 'failed']),
  eventsGenerated: z.int().nonnegative(),
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
  error: z.string().nullable(),
});

export const endOfDayReportSchema = z.object({
  businessDate: z.iso.date(),
  holdsExpired: z.int().nonnegative(),
  transfersSettled: z.int().nonnegative(),
  interestAccrued: moneySchema,
  feesCharged: moneySchema,
  loansAged: z.int().nonnegative(),
  statementsGenerated: z.int().nonnegative(),
  amlAlertsRaised: z.int().nonnegative(),
  ledgerBalanced: z.boolean(),
  suspenseZeroed: z.boolean(),
  durationMs: z.int().nonnegative(),
  completedAt: isoDateTimeSchema,
});

/** Result of asserting the six ledger invariants from agent_plan.md §4.4. */
export const ledgerIntegrityReportSchema = z.object({
  balanced: z.boolean(),
  checks: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      detail: z.string(),
    }),
  ),
  currencyTotals: z.array(z.object({ currency: z.string(), netMinorUnits: z.int() })),
  transactionsChecked: z.int().nonnegative(),
  entriesChecked: z.int().nonnegative(),
  driftDetected: z.array(
    z.object({ accountRef: z.string(), cached: z.int(), computed: z.int() }),
  ),
  checkedAt: isoDateTimeSchema,
  durationMs: z.int().nonnegative(),
});

export const simulationStateSchema = z.object({
  clock: clockStateSchema,
  rails: z.array(railProfileSchema),
  activeScenario: scenarioRunSchema.nullable(),
  chaos: z.object({
    enabled: z.boolean(),
    databaseLatencyMs: z.int().nonnegative(),
    randomFailureRate: z.number().min(0).max(1),
  }),
  seededAt: isoDateTimeSchema.nullable(),
});

export const featureFlagSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  rolloutPercentage: z.int().min(0).max(100),
  audience: z.enum(['all', 'staff', 'beta', 'tier_premier_plus']),
  updatedAt: isoDateTimeSchema,
});

export const updateFeatureFlagRequestSchema = z.object({
  enabled: z.boolean().optional(),
  rolloutPercentage: z.int().min(0).max(100).optional(),
  audience: z.enum(['all', 'staff', 'beta', 'tier_premier_plus']).optional(),
});

export type ClockState = z.infer<typeof clockStateSchema>;
export type AdvanceClockRequest = z.infer<typeof advanceClockRequestSchema>;
export type RailProfile = z.infer<typeof railProfileSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioRun = z.infer<typeof scenarioRunSchema>;
export type ScenarioName = (typeof SCENARIO_NAMES)[number];
export type EndOfDayReport = z.infer<typeof endOfDayReportSchema>;
export type LedgerIntegrityReport = z.infer<typeof ledgerIntegrityReportSchema>;
export type SimulationState = z.infer<typeof simulationStateSchema>;
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
