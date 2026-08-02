/**
 * Deterministic hashing for simulated decisions.
 *
 * Every simulated outcome in this module is a pure function of stable inputs (a customer id, a
 * check kind) rather than of randomness. That is what makes a demo reproducible: the same
 * customer always screens the same way, so a walkthrough can be scripted, a screenshot stays
 * true, and a bug report about "customer X fails liveness" is reproducible on another machine.
 *
 * FNV-1a is used because it is tiny, has no dependencies, and is stable across Node versions —
 * none of which would be true of a hash pulled from a library that may change its output.
 */

const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const SEPARATOR = 0x1f;
const UINT32_RANGE = 2 ** 32;

/** A stable unsigned 32-bit hash of the given parts, order- and boundary-sensitive. */
export function stableHash(...parts: readonly string[]): number {
  let hash = FNV_OFFSET_BASIS;

  for (const part of parts) {
    for (let index = 0; index < part.length; index += 1) {
      hash ^= part.charCodeAt(index);
      hash = Math.imul(hash, FNV_PRIME);
    }
    // Mixing a separator between parts stops ('ab', 'c') and ('a', 'bc') colliding.
    hash ^= SEPARATOR;
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

/** The same hash projected onto `[0, 1)`, for threshold comparisons. */
export function stableUnit(...parts: readonly string[]): number {
  return stableHash(...parts) / UINT32_RANGE;
}

/** A score rounded to three decimals, which is all a compliance report ever displays. */
export function toScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}
