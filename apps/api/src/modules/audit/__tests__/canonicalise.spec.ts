import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../domain/canonicalise.js';

describe('canonicalJson', () => {
  it('produces identical output regardless of key order', () => {
    const left = { b: 1, a: 2, c: { z: true, y: false } };
    const right = { c: { y: false, z: true }, a: 2, b: 1 };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
  });

  it('serialises dates as ISO-8601 so hashes are timezone-independent', () => {
    const at = new Date('2026-08-02T12:00:00.000Z');
    expect(canonicalJson({ at })).toBe('{"at":"2026-08-02T12:00:00.000Z"}');
  });

  it('drops undefined fields instead of failing on them', () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it('preserves array order — arrays are sequences, not maps', () => {
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it('is stable across repeated calls on the same input', () => {
    const value = { actor: 'ops', changes: [{ field: 'status', before: 'a', after: 'b' }] };
    expect(canonicalJson(value)).toBe(canonicalJson(value));
  });
});
