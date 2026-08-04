import { describe, expect, it } from 'vitest';

import {
  MICRO_DEPOSIT_ATTEMPTS,
  generateMicroDeposits,
  hashMicroDeposits,
  microDepositsMatch,
} from '../domain/micro-deposit.js';

const KEY = 'test-hmac-key';
const BENEFICIARY_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9B1';

describe('generateMicroDeposits', () => {
  it('is deterministic for a given seed', () => {
    expect(generateMicroDeposits('seed-1')).toEqual(generateMicroDeposits('seed-1'));
  });

  it('draws both amounts inside the one-to-ninety-nine minor-unit range', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const { first, second } = generateMicroDeposits(seed);
      for (const amount of [first, second]) {
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThanOrEqual(1);
        expect(amount).toBeLessThanOrEqual(99);
      }
    }
  });

  it('gives a real attempt budget of three', () => {
    expect(MICRO_DEPOSIT_ATTEMPTS).toBe(3);
  });
});

describe('hashMicroDeposits', () => {
  const amounts = { first: 12, second: 34 };

  it('produces a stable hex digest', () => {
    const digest = hashMicroDeposits(KEY, BENEFICIARY_ID, amounts);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashMicroDeposits(KEY, BENEFICIARY_ID, amounts)).toBe(digest);
  });

  it('binds the digest to the beneficiary so it cannot be replayed against another', () => {
    const other = hashMicroDeposits(KEY, '01J8ZCQ0R0K3M4N5P6Q7R8S9B9', amounts);
    expect(other).not.toBe(hashMicroDeposits(KEY, BENEFICIARY_ID, amounts));
  });

  it('changes when either amount changes', () => {
    const digest = hashMicroDeposits(KEY, BENEFICIARY_ID, amounts);
    expect(hashMicroDeposits(KEY, BENEFICIARY_ID, { first: 13, second: 34 })).not.toBe(digest);
    expect(hashMicroDeposits(KEY, BENEFICIARY_ID, { first: 12, second: 35 })).not.toBe(digest);
  });
});

describe('microDepositsMatch', () => {
  const amounts = { first: 12, second: 34 };
  const stored = hashMicroDeposits(KEY, BENEFICIARY_ID, amounts);

  it('accepts the digest of the same amounts', () => {
    expect(microDepositsMatch(stored, hashMicroDeposits(KEY, BENEFICIARY_ID, amounts))).toBe(true);
  });

  it('rejects a digest of different amounts', () => {
    const candidate = hashMicroDeposits(KEY, BENEFICIARY_ID, { first: 12, second: 35 });
    expect(microDepositsMatch(stored, candidate)).toBe(false);
  });

  it('rejects when nothing was stored', () => {
    expect(microDepositsMatch(null, stored)).toBe(false);
  });

  it('rejects a candidate of a different length without throwing', () => {
    expect(microDepositsMatch(stored, 'abcd')).toBe(false);
  });

  it('rejects a stored value that is not valid hex', () => {
    expect(microDepositsMatch('z'.repeat(64), stored)).toBe(false);
  });
});
