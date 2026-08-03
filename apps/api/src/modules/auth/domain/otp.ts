import { randomInt } from 'node:crypto';

/**
 * One-time passcode generation for the simulated SMS rail.
 *
 * `crypto.randomInt` rather than `Math.random` — the latter is banned repo-wide (lint,
 * deterministic seeding) and is also not a CSPRNG, which an OTP must be.
 */
export function generateNumericOtp(length: number): string {
  return randomInt(0, 10 ** length)
    .toString()
    .padStart(length, '0');
}

/**
 * Recovery codes are stored uppercased and grouped with dashes; customers type them every way
 * imaginable, so comparison happens on a canonical form.
 */
export function normaliseRecoveryCode(code: string): string {
  return code.trim().toUpperCase();
}
