import { LOCKOUT_LADDER_MS, MAX_FAILED_ATTEMPTS } from '../auth.constants.js';

/**
 * Progressive lockout policy, as pure functions so the ladder is testable without a database.
 *
 * Each successive lockout lasts longer than the last, so credential stuffing degrades to
 * uselessness while a forgetful customer is only ever inconvenienced for minutes.
 */

/** Lock duration after N consecutive failures; null while the account is still open. */
export function lockoutDurationMs(failedAttempts: number): number | null {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) {
    return null;
  }
  const step = Math.min(failedAttempts - MAX_FAILED_ATTEMPTS, LOCKOUT_LADDER_MS.length - 1);
  return (
    LOCKOUT_LADDER_MS[step] ?? LOCKOUT_LADDER_MS[LOCKOUT_LADDER_MS.length - 1] ?? 60_000
  );
}

/** Whole seconds left on a lock; 0 when there is no lock or it has already lapsed. */
export function lockoutRemainingSeconds(lockedUntil: Date | null, epochMs: number): number {
  if (lockedUntil === null || lockedUntil.getTime() <= epochMs) {
    return 0;
  }
  return Math.ceil((lockedUntil.getTime() - epochMs) / 1000);
}
