import { describe, expect, it } from 'vitest';

import {
  intBetween,
  pickStable,
  stableReference,
  unitInterval,
} from '../domain/deterministic.js';

describe('unitInterval', () => {
  it('is deterministic for the same parts', () => {
    expect(unitInterval('salt', 'a', 'b')).toBe(unitInterval('salt', 'a', 'b'));
  });

  it('returns a value in [0, 1)', () => {
    for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
      const value = unitInterval('salt', seed);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('varies with its parts', () => {
    expect(unitInterval('salt', 'a')).not.toBe(unitInterval('salt', 'b'));
    expect(unitInterval('one', 'a')).not.toBe(unitInterval('two', 'a'));
  });
});

describe('intBetween', () => {
  it('is deterministic and lands inside the inclusive range', () => {
    for (let index = 0; index < 25; index += 1) {
      const value = intBetween(12, 25, 'salt', `part-${index}`);
      expect(value).toBe(intBetween(12, 25, 'salt', `part-${index}`));
      expect(value).toBeGreaterThanOrEqual(12);
      expect(value).toBeLessThanOrEqual(25);
    }
  });

  it('returns the bound when min and max coincide', () => {
    expect(intBetween(7, 7, 'salt', 'part')).toBe(7);
  });
});

describe('pickStable', () => {
  const items = ['first', 'second', 'third'] as const;

  it('picks the same element for the same parts', () => {
    const picked = pickStable(items, 'salt', 'payment-1');
    expect(items).toContain(picked);
    expect(pickStable(items, 'salt', 'payment-1')).toBe(picked);
  });

  it('refuses to pick from an empty list', () => {
    expect(() => pickStable([], 'salt')).toThrow(RangeError);
  });
});

describe('stableReference', () => {
  it('formats as PREFIX- plus eight Crockford base32 characters', () => {
    const reference = stableReference('NGP', 'biller', 'payment-1');
    expect(reference).toMatch(/^NGP-[0-9A-HJKMNP-TV-Z]{8}$/);
  });

  it('is deterministic and varies with its parts', () => {
    expect(stableReference('NGP', 'biller', 'payment-1')).toBe(
      stableReference('NGP', 'biller', 'payment-1'),
    );
    expect(stableReference('NGP', 'biller', 'payment-1')).not.toBe(
      stableReference('NGP', 'biller', 'payment-2'),
    );
  });
});
