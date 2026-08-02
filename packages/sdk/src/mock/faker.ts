import { base, en, Faker } from '@faker-js/faker';

import { DEFAULT_MOCK_SEED, MOCK_REFERENCE_DATE } from './constants.js';

/**
 * A dedicated, seedable faker for the mock. Seeding makes a generated screen repeatable —
 * the same seed yields the same customers, balances and merchants on every run.
 */
export function createMockFaker(seed: number = DEFAULT_MOCK_SEED): Faker {
  const instance = new Faker({ locale: [en, base] });
  instance.seed(seed);
  instance.setDefaultRefDate(MOCK_REFERENCE_DATE);
  return instance;
}
