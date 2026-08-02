import {
  CROCKFORD_ALPHABET,
  REFERENCE_BODY_LENGTH,
  ULID_COUNTER_LENGTH,
  ULID_ENTROPY_LENGTH,
  ULID_TIME_LENGTH,
} from '../testing.constants.js';
import type { TestClock } from './clock.js';
import type { Prng } from './random.js';

const CROCKFORD_BASE = CROCKFORD_ALPHABET.length;
const ULID_TIME_RADIX = CROCKFORD_BASE ** ULID_TIME_LENGTH;

/**
 * Deterministic ULID generation.
 *
 * Same layout as the API's `ulid` (10 time chars + 16 entropy chars, Crockford base32) but the
 * entropy comes from the seeded PRNG and a monotonic counter instead of `crypto`, so a seeded
 * suite generates the same ids on every run and ids never collide within a run.
 */
export class IdGenerator {
  private counter = 0;

  constructor(
    private readonly clock: TestClock,
    private readonly random: Prng,
  ) {}

  /** A 26-char Crockford ULID matching `@icb/contracts` `idSchema`. */
  next(): string {
    this.counter += 1;
    const time = encodeTime(this.clock.epochMilliseconds());
    const entropy = this.randomChars(ULID_ENTROPY_LENGTH - ULID_COUNTER_LENGTH);
    return time + entropy + encodeCounter(this.counter);
  }

  /** Human-facing reference, e.g. `TRF-8F3K2M9Q` — same shape as the API's `newReference`. */
  reference(prefix: string): string {
    return `${prefix}-${this.randomChars(REFERENCE_BODY_LENGTH)}`;
  }

  private randomChars(length: number): string {
    let chars = '';
    for (let index = 0; index < length; index += 1) {
      chars += CROCKFORD_ALPHABET[Math.floor(this.random() * CROCKFORD_BASE)] ?? '0';
    }
    return chars;
  }
}

/** 48-bit epoch milliseconds as 10 Crockford chars, most significant first. */
function encodeTime(epochMs: number): string {
  let value = epochMs % ULID_TIME_RADIX;
  let encoded = '';
  for (let index = 0; index < ULID_TIME_LENGTH; index += 1) {
    encoded = (CROCKFORD_ALPHABET[value % CROCKFORD_BASE] ?? '0') + encoded;
    value = Math.floor(value / CROCKFORD_BASE);
  }
  return encoded;
}

/** Monotonic counter, zero-padded to fill the tail of the entropy section. */
function encodeCounter(counter: number): string {
  let value = counter;
  let encoded = '';
  for (let index = 0; index < ULID_COUNTER_LENGTH; index += 1) {
    encoded = (CROCKFORD_ALPHABET[value % CROCKFORD_BASE] ?? '0') + encoded;
    value = Math.floor(value / CROCKFORD_BASE);
  }
  return encoded;
}
