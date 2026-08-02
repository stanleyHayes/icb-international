import type { Scenario, ScenarioName } from '@icb/contracts';

import type { RandomHelpers } from '../seed/random.js';
import type { ScenarioToolkit } from './scenario.toolkit.js';

export type ScenarioIntensity = 'light' | 'normal' | 'heavy';

/** How far a scenario's shipped event counts are scaled. */
const INTENSITY_FACTOR: Readonly<Record<ScenarioIntensity, number>> = {
  light: 0.35,
  normal: 1,
  heavy: 2.5,
};

export function scaleFor(intensity: ScenarioIntensity, base: number): number {
  return Math.max(1, Math.round(base * INTENSITY_FACTOR[intensity]));
}

/**
 * Everything a scenario is handed.
 *
 * The random helper is the *only* source of variation. A scenario that reached for the clock's
 * wall time or an unseeded random would stop being replayable, and a demo that cannot be replayed
 * is a demo nobody trusts.
 */
export interface ScenarioContext {
  readonly random: RandomHelpers;
  readonly intensity: ScenarioIntensity;
  readonly toolkit: ScenarioToolkit;
  readonly runId: string;
}

/**
 * A named, replayable script.
 *
 * `execute` returns the number of events it actually generated — not the number it intended to,
 * which is why the count is reported rather than declared. A payday that skipped ten accounts for
 * insufficient funds must say ten fewer.
 */
export interface ScenarioScript {
  readonly name: ScenarioName;
  readonly definition: Scenario;
  execute(context: ScenarioContext): Promise<number>;
}
