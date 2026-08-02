import { describe, expect, it } from 'vitest';

import { buildOffsetPage, offsetOf } from './offset.js';

describe('buildOffsetPage', () => {
  it('computes totalPages from the total count', () => {
    const page = buildOffsetPage(['a', 'b'], 51, { page: 1, limit: 25 });

    expect(page).toEqual({ items: ['a', 'b'], page: 1, limit: 25, total: 51, totalPages: 3 });
  });

  it('reports zero pages for an empty table', () => {
    const page = buildOffsetPage([], 0, { page: 1, limit: 25 });

    expect(page.totalPages).toBe(0);
    expect(page.items).toEqual([]);
  });

  it('keeps an exact division exact', () => {
    const page = buildOffsetPage(['a'], 50, { page: 2, limit: 25 });

    expect(page.totalPages).toBe(2);
  });
});

describe('offsetOf', () => {
  it('is zero on the first page', () => {
    expect(offsetOf({ page: 1, limit: 25 })).toBe(0);
  });

  it('skips whole pages', () => {
    expect(offsetOf({ page: 3, limit: 10 })).toBe(20);
  });
});
