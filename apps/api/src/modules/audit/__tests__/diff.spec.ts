import { describe, expect, it } from 'vitest';

import { REDACTED_VALUE } from '../../../common/interceptors/redaction.constants.js';
import { ABSENT_VALUE, CHANGE_VALUE_MAX_LENGTH } from '../audit.constants.js';
import { diffChanges, maskSnapshot } from '../domain/diff.js';

describe('maskSnapshot', () => {
  it('returns null for absent snapshots', () => {
    expect(maskSnapshot(null)).toBeNull();
    expect(maskSnapshot(undefined)).toBeNull();
  });

  it('redacts sensitive keys before anything is stored', () => {
    const masked = maskSnapshot({ pan: '4242424242424242', password: 'hunter2', keep: 1 });
    expect(masked).toEqual({ pan: REDACTED_VALUE, password: REDACTED_VALUE, keep: 1 });
  });

  it('wraps non-object snapshots so the diff always has fields to walk', () => {
    expect(maskSnapshot('plain')).toEqual({ value: 'plain' });
  });
});

describe('diffChanges', () => {
  it('reports changed, added and removed fields in sorted order', () => {
    const changes = diffChanges(
      { status: 'active', limit: 100, gone: 'x' },
      { status: 'frozen', limit: 100, fresh: 'y' },
    );
    expect(changes).toEqual([
      { field: 'fresh', before: ABSENT_VALUE, after: 'y' },
      { field: 'gone', before: 'x', after: ABSENT_VALUE },
      { field: 'status', before: 'active', after: 'frozen' },
    ]);
  });

  it('yields no rows when the snapshots agree', () => {
    expect(diffChanges({ a: 1 }, { a: 1 })).toEqual([]);
    expect(diffChanges(null, null)).toEqual([]);
  });

  it('serialises nested values canonically so equal objects do not diff', () => {
    const before = { flags: { a: true, b: false } };
    const same = { flags: { b: false, a: true } };
    expect(diffChanges(before, same)).toEqual([]);
  });

  it('truncates oversized values rather than storing them whole', () => {
    const long = 'x'.repeat(CHANGE_VALUE_MAX_LENGTH * 2);
    const [change] = diffChanges(null, { note: long });
    expect(change?.after.length).toBe(CHANGE_VALUE_MAX_LENGTH + 3);
    expect(change?.after.endsWith('...')).toBe(true);
  });
});
