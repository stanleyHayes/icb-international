/**
 * Deterministic pseudo-random source.
 *
 * The seed exists so a demo is reproducible: the same seed rebuilds a byte-identical bank, which
 * makes a bug report point at a stable document and makes a screenshot still true tomorrow.
 * `Math.random()` is banned in seeded code for exactly this reason.
 *
 * mulberry32 — small, fast, and statistically adequate for generating plausible transactions.
 */
export function createRandom(seed: string): () => number {
  let state = hashSeed(seed);

  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export interface RandomHelpers {
  next: () => number;
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
  /** Normal-ish variation around a value, clamped so amounts stay plausible. */
  jitter: (value: number, spread: number) => number;
}

export function createHelpers(seed: string): RandomHelpers {
  const next = createRandom(seed);

  const int = (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min;
  const float = (min: number, max: number): number => next() * (max - min) + min;

  return {
    next,
    int,
    float,
    pick: <T,>(items: readonly T[]): T => {
      const item = items[int(0, items.length - 1)];
      if (item === undefined) {
        throw new RangeError('Cannot pick from an empty list');
      }
      return item;
    },
    chance: (probability: number): boolean => next() < probability,
    jitter: (value: number, spread: number): number => {
      const factor = 1 + (next() - 0.5) * 2 * spread;
      return Math.max(value * 0.1, value * factor);
    },
  };
}
