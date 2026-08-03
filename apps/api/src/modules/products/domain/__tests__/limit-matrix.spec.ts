import type { KycLevel } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { resolveLimits, type ProductLimitRow } from '../limit-matrix.js';

function row(kycLevel: KycLevel, overdraftMinorUnits = 0): ProductLimitRow {
  return {
    kycLevel,
    singleTransactionMinorUnits: null,
    dailyMinorUnits: null,
    monthlyMinorUnits: null,
    maxBalanceMinorUnits: null,
    overdraftMinorUnits,
  };
}

describe('resolveLimits', () => {
  it('returns the row for the exact level', () => {
    const matrix = [row('tier_1', 0), row('tier_2', 50_000)];
    expect(resolveLimits(matrix, 'tier_2')?.overdraftMinorUnits).toBe(50_000);
  });

  it('holds an unverified customer to the tier-1 row', () => {
    const matrix = [row('tier_1', 0), row('tier_2', 50_000)];
    expect(resolveLimits(matrix, null)?.kycLevel).toBe('tier_1');
  });

  it('falls back to tier 1 when the level has no explicit row', () => {
    const matrix = [row('tier_1', 10_000)];
    expect(resolveLimits(matrix, 'tier_3')?.overdraftMinorUnits).toBe(10_000);
  });

  it('returns null for an empty matrix rather than inventing limits', () => {
    expect(resolveLimits([], 'tier_1')).toBeNull();
  });
});
