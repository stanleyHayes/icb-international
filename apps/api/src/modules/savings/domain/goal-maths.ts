import { addDays, addMonths, clamp, daysBetween, monthsUntil } from './date-maths.js';

/**
 * Savings-goal progress.
 *
 * The three numbers a customer actually acts on: how far along they are, what they must set
 * aside each month to arrive on time, and whether they are currently behind. Kept pure so the
 * answer is identical in the API response, the scheduled reminder, and any test — a goal that
 * says "on track" in one place and "behind" in another destroys trust in the whole feature.
 */

export type ContributionFrequency = 'weekly' | 'fortnightly' | 'monthly';

export interface GoalProgressInput {
  readonly targetMinorUnits: number;
  readonly savedMinorUnits: number;
  /** When the goal was created — the start of the runway used to judge pace. */
  readonly startedOn: string;
  readonly today: string;
  readonly targetDate: string | null;
}

export interface GoalProgress {
  /** 0…1, clamped. The contract renders this as a bar, so it can never exceed one. */
  readonly progress: number;
  readonly remainingMinorUnits: number;
  /** Null when the goal has no target date — nothing is *required* by any particular month. */
  readonly requiredMonthlyMinorUnits: number | null;
  readonly onTrack: boolean | null;
  readonly achieved: boolean;
}

/** Still to find. Never negative: overshooting a goal does not create a negative shortfall. */
export function remainingMinorUnits(targetMinorUnits: number, savedMinorUnits: number): number {
  return Math.max(0, targetMinorUnits - savedMinorUnits);
}

/** Fraction of the target saved, clamped to 0…1 and rounded to four places for a stable wire value. */
export function progressRatio(targetMinorUnits: number, savedMinorUnits: number): number {
  if (targetMinorUnits <= 0) {
    return 1;
  }
  const ratio = clamp(savedMinorUnits / targetMinorUnits, 0, 1);
  return Math.round(ratio * 10_000) / 10_000;
}

/**
 * What must be set aside each month to arrive on the target date.
 *
 * Rounded *up*: quoting the exact quotient would leave the customer a minor unit short on the
 * last month, which is precisely the day it matters.
 */
export function requiredMonthlyMinorUnits(input: GoalProgressInput): number | null {
  if (input.targetDate === null) {
    return null;
  }
  const remaining = remainingMinorUnits(input.targetMinorUnits, input.savedMinorUnits);
  if (remaining === 0) {
    return 0;
  }
  return Math.ceil(remaining / monthsUntil(input.today, input.targetDate));
}

/**
 * Whether the goal is keeping pace.
 *
 * Pace is measured against a straight line from creation to target date, which is how a customer
 * intuitively reads a progress bar. A goal already met is on track regardless of the calendar.
 */
export function isOnTrack(input: GoalProgressInput): boolean | null {
  if (input.targetDate === null) {
    return null;
  }
  if (input.savedMinorUnits >= input.targetMinorUnits) {
    return true;
  }

  const totalDays = daysBetween(input.startedOn, input.targetDate);
  if (totalDays <= 0) {
    return false;
  }

  const elapsed = clamp(daysBetween(input.startedOn, input.today), 0, totalDays);
  const expected = Math.floor((input.targetMinorUnits * elapsed) / totalDays);
  return input.savedMinorUnits >= expected;
}

export function computeGoalProgress(input: GoalProgressInput): GoalProgress {
  return {
    progress: progressRatio(input.targetMinorUnits, input.savedMinorUnits),
    remainingMinorUnits: remainingMinorUnits(input.targetMinorUnits, input.savedMinorUnits),
    requiredMonthlyMinorUnits: requiredMonthlyMinorUnits(input),
    onTrack: isOnTrack(input),
    achieved: input.savedMinorUnits >= input.targetMinorUnits,
  };
}

/** The next date an automatic contribution should run, given its frequency. */
export function nextContributionDate(frequency: ContributionFrequency, fromIso: string): string {
  switch (frequency) {
    case 'weekly':
      return addDays(fromIso, 7);
    case 'fortnightly':
      return addDays(fromIso, 14);
    case 'monthly':
      return addMonths(fromIso, 1);
  }
}
