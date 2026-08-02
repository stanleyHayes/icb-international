/**
 * Deterministic pseudo-randomness for the simulated biller network.
 *
 * Every "random" thing a biller does — the balance it quotes, the day it falls due, whether it
 * rejects a payment — is derived by hashing stable inputs rather than by drawing from a random
 * source. Two consequences matter:
 *
 *  1. A balance enquiry is *idempotent*. A customer who refreshes the screen sees the same figure,
 *     which is what a real biller would return and what makes the number trustworthy.
 *  2. A failure is reproducible. "Payment BPY-… failed" can be replayed from its identifier alone,
 *     so a bug report points at something a developer can actually reproduce.
 *
 * `Math.random()` is banned in this codebase for exactly this reason (agent_plan.md N8).
 */

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const UINT32_RANGE = 4_294_967_296;

/** FNV-1a. Small, fast, and well-distributed enough for simulated behaviour. */
function hash32(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** A stable value in [0, 1) for the given parts. */
export function unitInterval(...parts: readonly string[]): number {
  return hash32(parts.join('|')) / UINT32_RANGE;
}

/** A stable integer in [min, max], both inclusive. */
export function intBetween(min: number, max: number, ...parts: readonly string[]): number {
  return min + Math.floor(unitInterval(...parts) * (max - min + 1));
}

/** A stable element of a non-empty list. */
export function pickStable<T>(items: readonly T[], ...parts: readonly string[]): T {
  const item = items[intBetween(0, items.length - 1, ...parts)];
  if (item === undefined) {
    throw new RangeError('Cannot pick from an empty list');
  }
  return item;
}

/** Crockford base32 minus the characters that are misread aloud — the same alphabet as ULID. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REFERENCE_BODY_LENGTH = 8;

/**
 * A stable, human-quotable reference such as `NGP-4F2K8M1Q`.
 *
 * This is what a customer reads out to a biller's call centre when a payment is disputed, so it
 * must be short, unambiguous, and — because it is derived rather than drawn — recoverable if the
 * record is ever rebuilt.
 */
export function stableReference(prefix: string, ...parts: readonly string[]): string {
  let body = '';
  for (let index = 0; index < REFERENCE_BODY_LENGTH; index += 1) {
    body += CROCKFORD[intBetween(0, CROCKFORD.length - 1, ...parts, String(index))] ?? '0';
  }
  return `${prefix}-${body}`;
}
