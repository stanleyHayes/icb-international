import {
  SCENARIO_NAMES,
  SIMULATION_RAILS,
  type FeatureFlag,
  type RailProfile,
  type ScenarioName,
  type ScenarioRun,
  type SimulationRail,
} from '@icb/contracts';

import { NotFoundError } from '../../../common/errors/index.js';
import type {
  ScenarioRunDoc,
  SimFeatureFlagDoc,
  StoredRailProfile,
} from './simulation.schemas.js';

/**
 * Persistence to contract.
 *
 * Narrowing happens here, at the boundary, so that a value hand-edited into Mongo fails loudly on
 * read rather than flowing through the simulator as an unrecognised rail or audience.
 */

export function toSimulationRail(value: string): SimulationRail {
  const rail = SIMULATION_RAILS.find((candidate) => candidate === value);
  if (!rail) {
    throw new NotFoundError('Rail', value);
  }
  return rail;
}

export function toRailProfile(stored: StoredRailProfile): RailProfile {
  return {
    rail: toSimulationRail(stored.rail),
    enabled: stored.enabled,
    minLatencyMs: stored.minLatencyMs,
    maxLatencyMs: stored.maxLatencyMs,
    failureRate: stored.failureRate,
    failureCodes: stored.failureCodes.map((entry) => ({
      code: entry.code,
      label: entry.label,
      weight: entry.weight,
    })),
    settlementDelayHours: stored.settlementDelayHours,
    cutOffTime: stored.cutOffTime,
  };
}

export function toStoredRailProfile(profile: RailProfile): StoredRailProfile {
  return {
    rail: profile.rail,
    enabled: profile.enabled,
    minLatencyMs: profile.minLatencyMs,
    maxLatencyMs: profile.maxLatencyMs,
    failureRate: profile.failureRate,
    failureCodes: profile.failureCodes.map((entry) => ({ ...entry })),
    settlementDelayHours: profile.settlementDelayHours,
    cutOffTime: profile.cutOffTime,
  };
}

const SCENARIO_STATUSES = ['running', 'completed', 'failed'] as const;
const INTENSITIES = ['light', 'normal', 'heavy'] as const;

export function toScenarioName(value: string): ScenarioName {
  const name = SCENARIO_NAMES.find((candidate) => candidate === value);
  if (!name) {
    throw new NotFoundError('Scenario', value);
  }
  return name;
}

export function toScenarioRun(document: ScenarioRunDoc): ScenarioRun {
  return {
    id: document._id,
    name: toScenarioName(document.name),
    seed: document.seed,
    intensity: INTENSITIES.find((value) => value === document.intensity) ?? 'normal',
    status: SCENARIO_STATUSES.find((value) => value === document.status) ?? 'failed',
    eventsGenerated: document.eventsGenerated,
    startedAt: document.startedAt.toISOString(),
    completedAt: document.completedAt?.toISOString() ?? null,
    error: document.error,
  };
}

const AUDIENCES = ['all', 'staff', 'beta', 'tier_premier_plus'] as const;

export function toFeatureFlag(document: SimFeatureFlagDoc): FeatureFlag {
  return {
    key: document.key,
    label: document.label,
    description: document.description,
    enabled: document.enabled,
    rolloutPercentage: document.rolloutPercentage,
    audience: AUDIENCES.find((value) => value === document.audience) ?? 'all',
    updatedAt: document.updatedAt.toISOString(),
  };
}
