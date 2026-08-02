import { type Faker } from '@faker-js/faker';

import { CROCKFORD_ALPHABET, ULID_LENGTH } from './constants.js';

type SampleGenerator = (faker: Faker) => string;

function digits(faker: Faker, count: number): string {
  return Array.from({ length: count }, () => String(faker.number.int({ min: 0, max: 9 }))).join('');
}

function ulid(faker: Faker): string {
  return Array.from({ length: ULID_LENGTH }, () =>
    CROCKFORD_ALPHABET.charAt(faker.number.int({ min: 0, max: CROCKFORD_ALPHABET.length - 1 })),
  ).join('');
}

/**
 * Sample strings for every regex constraint in `@icb/contracts`, keyed by `RegExp.source`.
 * A pattern that is missing here falls back to an alphanumeric string and will fail the mock
 * smoke test loudly rather than silently serving invalid data.
 */
export const REGEX_SAMPLES: Readonly<Record<string, SampleGenerator>> = {
  '^[0-9A-HJKMNP-TV-Z]{26}$': ulid,
  '^\\+[1-9]\\d{7,14}$': (f) => `+233${digits(f, 9)}`,
  '^\\d{10}$': (f) => digits(f, 10),
  '^\\d{2}-\\d{2}-\\d{2}$': (f) => `${digits(f, 2)}-${digits(f, 2)}-${digits(f, 2)}`,
  '^[A-Z]{2}$': () => 'GH',
  '^[a-z]{2}(-[A-Z]{2})?$': () => 'en-GB',
  '^\\d{4}$': (f) => digits(f, 4),
  '^\\d{16}$': (f) => digits(f, 16),
  '^\\d{3,4}$': (f) => digits(f, 3),
  '^\\d{4}-\\d{2}$': () => '2026-01',
  '^\\d{2}:\\d{2}$': () => '08:30',
  '^[A-Z]{3}/[A-Z]{3}$': () => 'USD/GHS',
  '^P(\\d+D)?(T(\\d+H)?(\\d+M)?(\\d+S)?)?$': () => 'P30D',
};

const FALLBACK_LENGTH = 12;

export function regexSample(pattern: RegExp, faker: Faker): string {
  const generator = REGEX_SAMPLES[pattern.source];
  return generator ? generator(faker) : faker.string.alphanumeric(FALLBACK_LENGTH);
}
