import { en, Faker } from '@faker-js/faker';

import { DEFAULT_SEED } from '../testing.constants.js';
import { TestClock } from './clock.js';
import { IdGenerator } from './identifiers.js';
import { chance, createPrng, digitString, intBetween, pickOne, type Prng } from './random.js';

/**
 * Everything a factory needs to build an entity deterministically.
 *
 * One context per test (or per suite) — it carries the clock, the seeded faker, and the id
 * generator, so determinism is a property of the context, not of global state. Two contexts
 * created with the same seed produce identical entities in identical order.
 */
export interface FactoryContext {
  readonly clock: TestClock;
  readonly faker: Faker;
  readonly ids: IdGenerator;
  readonly random: Prng;
  nextId(): string;
  reference(prefix: string): string;
  intBetween(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  digits(length: number): string;
}

export interface FactoryContextOptions {
  /** Defaults to {@link DEFAULT_SEED}. Pass a distinct seed per parallel suite. */
  readonly seed?: number;
  /** Defaults to a fixed clock at the package epoch. */
  readonly clock?: TestClock;
}

export function createFactoryContext(options: FactoryContextOptions = {}): FactoryContext {
  const seed = options.seed ?? DEFAULT_SEED;
  const clock = options.clock ?? TestClock.fixed();
  const random = createPrng(seed);
  const faker = new Faker({ locale: en });
  faker.seed(seed);

  return {
    clock,
    faker,
    ids: new IdGenerator(clock, random),
    random,
    nextId() {
      return this.ids.next();
    },
    reference(prefix: string) {
      return this.ids.reference(prefix);
    },
    intBetween(min: number, max: number) {
      return intBetween(random, min, max);
    },
    pick<T>(items: readonly T[]): T {
      return pickOne(random, items);
    },
    chance(probability: number) {
      return chance(random, probability);
    },
    digits(length: number) {
      return digitString(random, length);
    },
  };
}
