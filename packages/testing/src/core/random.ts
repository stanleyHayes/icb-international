/**
 * Seeded pseudo-randomness.
 *
 * mulberry32: tiny, fast, and stable across Node versions — which is the whole point. The same
 * seed must produce the same customers, accounts, and postings on every machine, forever.
 */

const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4_294_967_296;

import { FactoryOverrideError } from '../errors.js';

export type Prng = () => number;

/** A deterministic stream of floats in [0, 1). */
export function createPrng(seed: number): Prng {
  let state = seed >>> 0;
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

/** Integer in [min, max], inclusive on both ends. */
export function intBetween(random: Prng, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Uniform element of a non-empty list. */
export function pickOne<T>(random: Prng, items: readonly T[]): T {
  const index = Math.floor(random() * items.length);
  const item = items[index];
  if (item === undefined) {
    throw new FactoryOverrideError('pickOne requires a non-empty list');
  }
  return item;
}

/** True with the given probability (0..1). */
export function chance(random: Prng, probability: number): boolean {
  return random() < probability;
}

/** A string of `length` decimal digits, never starting with zero unless length is 1. */
export function digitString(random: Prng, length: number): string {
  let digits = '';
  for (let index = 0; index < length; index += 1) {
    const floor = index === 0 && length > 1 ? 1 : 0;
    digits += String(intBetween(random, floor, 9));
  }
  return digits;
}
