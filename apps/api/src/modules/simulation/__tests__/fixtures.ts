import type { RailProfile, ScenarioRun } from '@icb/contracts';

import {
  SIM_STATE_ID,
  type SimFeatureFlagDoc,
  type SimStateDoc,
  type StoredRailProfile,
} from '../infrastructure/simulation.schemas.js';

/** A Tuesday, and not a bank holiday: a plain business day. */
export const NOW = new Date('2026-08-04T10:00:00.000Z');

/** The `sim_state` singleton with everything at rest; tests override what they exercise. */
export function simStateDoc(overrides: Record<string, unknown> = {}): SimStateDoc {
  return {
    _id: SIM_STATE_ID,
    clockOffsetMs: 0,
    clockFrozen: false,
    railProfiles: [],
    chaosEnabled: false,
    chaosDatabaseLatencyMs: 0,
    chaosRandomFailureRate: 0,
    activeScenarioRunId: null,
    seededAt: null,
    ...overrides,
  };
}

/** A stored ACH profile, as read back from `sim_state`. */
export function storedRailProfile(overrides: Record<string, unknown> = {}): StoredRailProfile {
  return {
    rail: 'ach',
    enabled: true,
    minLatencyMs: 50,
    maxLatencyMs: 250,
    failureRate: 0.01,
    failureCodes: [{ code: 'R01', label: 'Insufficient funds', weight: 1 }],
    settlementDelayHours: 24,
    cutOffTime: '16:00',
    ...overrides,
  };
}

/** The contract twin of `storedRailProfile`, for asserting the mapper round-trip. */
export function railProfile(overrides: Record<string, unknown> = {}): RailProfile {
  return {
    rail: 'ach',
    enabled: true,
    minLatencyMs: 50,
    maxLatencyMs: 250,
    failureRate: 0.01,
    failureCodes: [{ code: 'R01', label: 'Insufficient funds', weight: 1 }],
    settlementDelayHours: 24,
    cutOffTime: '16:00',
    ...overrides,
  };
}

/** A stored feature flag; tests override the fields they exercise. */
export function featureFlagDoc(overrides: Record<string, unknown> = {}): SimFeatureFlagDoc {
  return {
    _id: 'flag-1',
    key: 'spend_insights',
    label: 'Spending insights',
    description: 'Categorised spending analysis and month-on-month comparisons.',
    enabled: true,
    rolloutPercentage: 100,
    audience: 'beta',
    updatedAt: NOW,
    ...overrides,
  };
}

/** A completed scenario run, as the runner reports it. */
export function scenarioRun(overrides: Record<string, unknown> = {}): ScenarioRun {
  return {
    id: 'run-1',
    name: 'payday',
    seed: 'demo-seed',
    intensity: 'normal',
    status: 'completed',
    eventsGenerated: 120,
    startedAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    error: null,
    ...overrides,
  };
}
