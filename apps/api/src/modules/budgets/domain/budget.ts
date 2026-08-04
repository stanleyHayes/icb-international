import { APPROACHING_THRESHOLD_PER_MILLE } from '../budgets.constants.js';

/** How the month's spend stands against the limit, worst last. */
export const BUDGET_STATUSES = ['on_track', 'approaching', 'exceeded'] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

const PER_MILLE = 1000;

/**
 * The budget verdict, in integer arithmetic: `spent × 1000 ≥ limit × 800` avoids the float
 * division that a percentage would need. An exactly-spent budget is still on track — the
 * limit is a ceiling, not a tripwire.
 */
export function evaluateBudget(limitMinorUnits: number, spentMinorUnits: number): BudgetStatus {
  if (spentMinorUnits > limitMinorUnits) return 'exceeded';
  if (spentMinorUnits * PER_MILLE >= limitMinorUnits * APPROACHING_THRESHOLD_PER_MILLE) {
    return 'approaching';
  }
  return 'on_track';
}
