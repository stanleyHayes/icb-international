import type { RailProfile } from '@icb/contracts';

import type { RandomHelpers } from '../seed/random.js';
import type { WeightedCode } from './rail-codes.js';

/**
 * Sampling helpers shared by every adapter.
 *
 * All of it is driven by the injected seeded PRNG. `Math.random()` would make a scenario
 * irreproducible, which defeats the point of having scenarios at all: the same seed must rebuild
 * the same failures, in the same order, against the same accounts.
 */

/** Uniform draw inside the profile's latency band. */
export function sampleLatencyMs(profile: RailProfile, random: RandomHelpers): number {
  const low = Math.min(profile.minLatencyMs, profile.maxLatencyMs);
  const high = Math.max(profile.minLatencyMs, profile.maxLatencyMs);
  return random.int(low, high);
}

export function shouldFail(profile: RailProfile, random: RandomHelpers): boolean {
  return random.chance(profile.failureRate);
}

/**
 * Weighted draw over the profile's failure codes, falling back to the adapter's shipped table
 * when an operator has cleared the list but left a non-zero failure rate.
 */
export function pickFailureCode(
  profile: RailProfile,
  fallback: readonly WeightedCode[],
  random: RandomHelpers,
): WeightedCode {
  const codes = profile.failureCodes.length > 0 ? profile.failureCodes : fallback;
  const total = codes.reduce((sum, entry) => sum + Math.max(entry.weight, 0), 0);

  if (total <= 0) {
    return codes[0] ?? { code: 'UNKNOWN', label: 'Rejected by the network', weight: 1 };
  }

  let cursor = random.float(0, total);
  for (const entry of codes) {
    cursor -= Math.max(entry.weight, 0);
    if (cursor <= 0) {
      return entry;
    }
  }
  return codes[codes.length - 1] ?? { code: 'UNKNOWN', label: 'Rejected', weight: 1 };
}

const DIGITS = '0123456789';
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Fixed-width numeric field, e.g. an ISO-8583 STAN or a NACHA trace number. */
export function numericField(length: number, random: RandomHelpers): string {
  return draw(DIGITS, length, random);
}

/** Fixed-width alphanumeric field, e.g. a Fedwire IMAD sequence or a SWIFT reference. */
export function alphanumericField(length: number, random: RandomHelpers): string {
  return draw(ALPHANUMERIC, length, random);
}

function draw(alphabet: string, length: number, random: RandomHelpers): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += alphabet[random.int(0, alphabet.length - 1)] ?? '0';
  }
  return value;
}

/** `YYMMDD`, the date form every one of these networks uses on the wire. */
export function wireDate(date: Date): string {
  return date.toISOString().slice(2, 10).replace(/-/g, '');
}

/** `hhmmss`, for ISO-8583 DE12 and friends. */
export function wireTime(date: Date): string {
  return date.toISOString().slice(11, 19).replace(/:/g, '');
}
