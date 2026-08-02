import type { RepaymentFrequency } from '@icb/contracts';

/**
 * Due-date arithmetic for a repayment schedule.
 *
 * Pure: every function takes the anchor instant as an argument, so the caller (which holds
 * ClockService) decides what "now" means and this file never reads a host clock.
 *
 * Month-based frequencies keep the anchor's day of month and clamp to the end of short months —
 * a loan drawn on the 31st falls due on the 28th of February, not the 3rd of March.
 */

const MS_PER_DAY = 86_400_000;

const DAY_STEPS: Partial<Record<RepaymentFrequency, number>> = {
  weekly: 7,
  fortnightly: 14,
};

const MONTH_STEPS: Partial<Record<RepaymentFrequency, number>> = {
  monthly: 1,
  quarterly: 3,
};

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse an ISO calendar date into the UTC instant at its start. */
export function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function addMonths(anchor: Date, months: number): Date {
  const day = anchor.getUTCDate();
  const target = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

/** The instant `periods` repayment periods after `anchor`. */
export function addPeriods(anchor: Date, periods: number, frequency: RepaymentFrequency): Date {
  const days = DAY_STEPS[frequency];
  if (days !== undefined) {
    return new Date(anchor.getTime() + periods * days * MS_PER_DAY);
  }
  return addMonths(anchor, periods * (MONTH_STEPS[frequency] ?? 1));
}

/**
 * The due dates for `count` instalments, the first falling one full period after the anchor.
 * A loan disbursed today is not due today.
 */
export function dueDateSequence(
  anchor: Date,
  count: number,
  frequency: RepaymentFrequency,
): string[] {
  return Array.from({ length: count }, (_, index) =>
    toIsoDate(addPeriods(anchor, index + 1, frequency)),
  );
}

/** Whole days between two ISO calendar dates. Negative when `to` precedes `from`. */
export function daysBetweenIso(from: string, to: string): number {
  return Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / MS_PER_DAY);
}
