import { describe, expect, it } from 'vitest';

import { evaluateBudget } from '../domain/budget.js';

describe('evaluateBudget', () => {
  it('is on track below 80% of the limit', () => {
    expect(evaluateBudget(50_000, 39_999)).toBe('on_track');
  });

  it('is approaching from 80% of the limit', () => {
    expect(evaluateBudget(50_000, 40_000)).toBe('approaching');
  });

  it('is still approaching at exactly the limit — the ceiling is not a tripwire', () => {
    expect(evaluateBudget(50_000, 50_000)).toBe('approaching');
  });

  it('is exceeded once spend passes the limit', () => {
    expect(evaluateBudget(50_000, 50_001)).toBe('exceeded');
  });
});
