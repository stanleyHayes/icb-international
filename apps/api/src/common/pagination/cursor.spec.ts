import { describe, expect, it } from 'vitest';

import { buildCursorPage, decodeCursor, encodeCursor } from './cursor.js';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips an id', () => {
    const cursor = encodeCursor('01JXYZABCDEF');
    expect(decodeCursor(cursor)).toBe('01JXYZABCDEF');
  });

  it('round-trips ids containing separator-like characters', () => {
    const cursor = encodeCursor('txn:2026.08/02');
    expect(decodeCursor(cursor)).toBe('txn:2026.08/02');
  });

  it('rejects a cursor from another version', () => {
    expect(() => decodeCursor('v9.bm9wZQ')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });

  it('rejects garbage', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });

  it('rejects a cursor whose payload does not re-encode identically', () => {
    expect(() => decodeCursor('v1.###')).toThrowError(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });
});

describe('buildCursorPage', () => {
  const idOf = (item: { id: string }): string => item.id;

  it('returns a full page with a next cursor when an extra row was fetched', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const page = buildCursorPage(rows, 2, idOf);

    expect(page.items).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeCursor('b'));
  });

  it('returns no cursor on the final page', () => {
    const page = buildCursorPage([{ id: 'a' }], 2, idOf);

    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('handles an empty result', () => {
    const page = buildCursorPage([], 25, idOf);

    expect(page).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it('continues from a decoded cursor', () => {
    const first = buildCursorPage([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 2, idOf);
    expect(first.nextCursor).not.toBeNull();
    const resumeAfter = decodeCursor(first.nextCursor as string);
    expect(resumeAfter).toBe('b');
  });
});
