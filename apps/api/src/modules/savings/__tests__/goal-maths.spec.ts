import { describe, expect, it } from 'vitest';

import {
  computeGoalProgress,
  isOnTrack,
  nextContributionDate,
  progressRatio,
  remainingMinorUnits,
  requiredMonthlyMinorUnits,
  type GoalProgressInput,
} from '../domain/goal-maths.js';

function input(overrides: Partial<GoalProgressInput> = {}): GoalProgressInput {
  return {
    targetMinorUnits: 120_000,
    savedMinorUnits: 30_000,
    startedOn: '2026-01-01',
    today: '2026-04-01',
    targetDate: '2027-01-01',
    ...overrides,
  };
}

describe('remainingMinorUnits', () => {
  it('never goes negative when the goal is overshot', () => {
    expect(remainingMinorUnits(100, 250)).toBe(0);
    expect(remainingMinorUnits(100, 40)).toBe(60);
  });
});

describe('progressRatio', () => {
  it('treats a zero target as fully achieved', () => {
    expect(progressRatio(0, 0)).toBe(1);
  });

  it('clamps to 0…1 and rounds to four places', () => {
    expect(progressRatio(120_000, 30_000)).toBe(0.25);
    expect(progressRatio(120_000, 999_999)).toBe(1);
    // Six places of tolerance, not four: an unrounded 0.333333… is 3.3e-6 away and must still fail.
    expect(progressRatio(3, 1)).toBeCloseTo(0.3333, 6);
    expect(progressRatio(120_000, -5)).toBe(0);
  });
});

describe('requiredMonthlyMinorUnits', () => {
  it('is null when the goal has no target date', () => {
    expect(requiredMonthlyMinorUnits(input({ targetDate: null }))).toBeNull();
  });

  it('is zero when nothing remains', () => {
    expect(requiredMonthlyMinorUnits(input({ savedMinorUnits: 120_000 }))).toBe(0);
  });

  it('rounds up so the final month is not short', () => {
    // 2026-04-01 → 2026-12-01 is 244 days ≈ 9 months; 90_000 over 9 is exact, 90_001 rounds up.
    expect(
      requiredMonthlyMinorUnits(input({ savedMinorUnits: 30_000, targetDate: '2026-12-01' })),
    ).toBe(10_000);
    expect(
      requiredMonthlyMinorUnits(input({ savedMinorUnits: 29_999, targetDate: '2026-12-01' })),
    ).toBe(10_001);
  });
});

describe('isOnTrack', () => {
  it('is null without a target date', () => {
    expect(isOnTrack(input({ targetDate: null }))).toBeNull();
  });

  it('is true once the goal is met, whatever the calendar says', () => {
    expect(isOnTrack(input({ savedMinorUnits: 120_000, targetDate: '2026-01-15' }))).toBe(true);
  });

  it('is false when the target date is not after the start', () => {
    expect(isOnTrack(input({ targetDate: '2026-01-01' }))).toBe(false);
  });

  it('compares savings against the straight-line pace', () => {
    // Half the runway has passed; a quarter saved is behind, half saved is on track.
    expect(isOnTrack(input({ today: '2026-07-02', savedMinorUnits: 30_000 }))).toBe(false);
    expect(isOnTrack(input({ today: '2026-07-02', savedMinorUnits: 60_000 }))).toBe(true);
  });
});

describe('computeGoalProgress', () => {
  it('combines the four figures', () => {
    const progress = computeGoalProgress(input({ savedMinorUnits: 120_000 }));

    expect(progress).toEqual({
      progress: 1,
      remainingMinorUnits: 0,
      requiredMonthlyMinorUnits: 0,
      onTrack: true,
      achieved: true,
    });
  });
});

describe('nextContributionDate', () => {
  it('advances by the contribution frequency', () => {
    expect(nextContributionDate('weekly', '2026-08-04')).toBe('2026-08-11');
    expect(nextContributionDate('fortnightly', '2026-08-04')).toBe('2026-08-18');
    expect(nextContributionDate('monthly', '2026-08-04')).toBe('2026-09-04');
  });
});
