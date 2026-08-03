import { ConflictError, ValidationError } from '../../../common/errors/index.js';

/**
 * Effective-dated rate schedules.
 *
 * A product's interest rate is a time series, not a scalar: pricing changes are announced in
 * advance and take effect at an instant, and accrual must answer "what was the rate on *that*
 * day?", not "what is the rate now?". These are pure functions over the schedule so the
 * interest engine (BE-18) and the rates table resolve identically.
 */

export const MIN_RATE_PERCENT = 0;
export const MAX_RATE_PERCENT = 100;

export interface RateChange {
  readonly effectiveFrom: Date;
  readonly rate: number;
}

/** The change in force at `at`: the latest entry whose `effectiveFrom` is not in the future. */
export function resolveRateAt(
  schedule: readonly RateChange[],
  at: Date,
): RateChange | null {
  let resolved: RateChange | null = null;
  for (const change of schedule) {
    const takesEffect = change.effectiveFrom.getTime() <= at.getTime();
    const isLater = resolved !== null && change.effectiveFrom.getTime() > resolved.effectiveFrom.getTime();
    if (takesEffect && (resolved === null || isLater)) {
      resolved = change;
    }
  }
  return resolved;
}

/** When the rate last changed on or before `at` — the "effective from" of a published table. */
export function lastChangeBefore(schedule: readonly RateChange[], at: Date): Date | null {
  return resolveRateAt(schedule, at)?.effectiveFrom ?? null;
}

/**
 * Append a change, keeping the schedule ordered by `effectiveFrom`.
 * Rejects out-of-range rates and duplicate instants — two rates effective at the same moment
 * would make resolution order-dependent.
 */
export function insertRateChange(
  schedule: readonly RateChange[],
  change: RateChange,
): RateChange[] {
  assertValidRateChange(schedule, change);
  return [...schedule, change].sort(
    (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
  );
}

function assertValidRateChange(schedule: readonly RateChange[], change: RateChange): void {
  if (!Number.isFinite(change.rate) || change.rate < MIN_RATE_PERCENT || change.rate > MAX_RATE_PERCENT) {
    throw new ValidationError('The rate is out of range', [
      { path: 'rate', message: `must be between ${MIN_RATE_PERCENT} and ${MAX_RATE_PERCENT}` },
    ]);
  }
  const duplicate = schedule.some(
    (entry) => entry.effectiveFrom.getTime() === change.effectiveFrom.getTime(),
  );
  if (duplicate) {
    throw new ConflictError('A rate change already takes effect at that instant', {
      effectiveFrom: change.effectiveFrom.toISOString(),
    });
  }
}
