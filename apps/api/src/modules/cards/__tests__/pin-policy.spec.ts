import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { assertPinAllowed, isTrivialPin } from '../domain/pin-policy.js';

describe('isTrivialPin', () => {
  it('rejects repeated digits', () => {
    expect(isTrivialPin('1111')).toBe(true);
    expect(isTrivialPin('0000')).toBe(true);
  });

  it('rejects ascending and descending runs, wrapping through zero', () => {
    expect(isTrivialPin('1234')).toBe(true);
    expect(isTrivialPin('9876')).toBe(true);
    expect(isTrivialPin('8901')).toBe(true); // 8→9→0→1 wraps
  });

  it('rejects alternating pairs', () => {
    expect(isTrivialPin('1212')).toBe(true);
    expect(isTrivialPin('4545')).toBe(true);
  });

  it('accepts ordinary PINs', () => {
    expect(isTrivialPin('5392')).toBe(false);
    expect(isTrivialPin('1123')).toBe(false); // a pair is not a repeat of all four
    expect(isTrivialPin('1324')).toBe(false); // not a run
  });
});

describe('assertPinAllowed', () => {
  it('rejects malformed PINs', () => {
    for (const pin of ['', '123', '12345', '12a4']) {
      expect(() => assertPinAllowed(pin)).toThrow(DomainError);
    }
    expect(() => assertPinAllowed('123')).toThrow('exactly four digits');
  });

  it('rejects trivial PINs with a policy message', () => {
    expect(() => assertPinAllowed('4321')).toThrow('too easy to guess');
  });

  it('allows a strong PIN', () => {
    expect(() => assertPinAllowed('5392')).not.toThrow();
  });
});
