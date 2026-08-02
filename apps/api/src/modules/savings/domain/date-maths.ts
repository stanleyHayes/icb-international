/**
 * Calendar arithmetic for savings and term deposits.
 *
 * Dates here are ISO calendar strings (`YYYY-MM-DD`), not instants. A deposit matures on a day,
 * a goal targets a day, and interest accrues per day — modelling any of those as a timestamp
 * invites a one-day error the first time a customer sits in a different timezone from the bank.
 * Everything is parsed at UTC midnight so a day count is a subtraction and nothing else.
 *
 * Pure functions only: no clock, no I/O. The caller supplies "today" from ClockService.
 */

const MS_PER_DAY = 86_400_000;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Mean Gregorian month. Used only to estimate "how many months are left", never to move money. */
export const AVERAGE_DAYS_PER_MONTH = 30.436_875;

interface CalendarParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

function parseIso(iso: string): CalendarParts {
  const match = ISO_DATE_PATTERN.exec(iso);
  if (!match) {
    throw new RangeError(`Expected an ISO calendar date (YYYY-MM-DD), received "${iso}"`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatIso(year: number, month: number, day: number): string {
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');
  return `${year}-${paddedMonth}-${paddedDay}`;
}

/** Days since the Unix epoch for an ISO calendar date. */
export function toEpochDay(iso: string): number {
  const parts = parseIso(iso);
  return Math.round(Date.UTC(parts.year, parts.month - 1, parts.day) / MS_PER_DAY);
}

/** Whole days from `fromIso` to `toIso`. Negative when `toIso` is the earlier date. */
export function daysBetween(fromIso: string, toIso: string): number {
  return toEpochDay(toIso) - toEpochDay(fromIso);
}

/**
 * Add whole months, clamping to the end of the target month.
 *
 * A 12-month deposit opened on 31 January matures on 31 January; a 1-month deposit opened on
 * 31 January matures on 28 (or 29) February. Rolling into March instead would pay a day of
 * interest the customer never contracted for.
 */
export function addMonths(iso: string, months: number): string {
  const parts = parseIso(iso);
  const anchor = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + 1;
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return formatIso(year, month, Math.min(parts.day, lastDayOfMonth));
}

/** Add whole days to an ISO calendar date. */
export function addDays(iso: string, days: number): string {
  const shifted = new Date((toEpochDay(iso) + days) * MS_PER_DAY);
  return formatIso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/**
 * Whole months remaining until `toIso`, never fewer than one.
 *
 * Rounded up on purpose: a target 40 days away needs two contributions, not 1.3 of one, and
 * quoting the lower figure would leave the customer short on the day that matters.
 */
export function monthsUntil(fromIso: string, toIso: string): number {
  const days = daysBetween(fromIso, toIso);
  if (days <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(days / AVERAGE_DAYS_PER_MONTH));
}

/** Clamp a value into an inclusive range. Shared by the accrual and progress maths. */
export function clamp(value: number, lower: number, upper: number): number {
  if (value < lower) return lower;
  if (value > upper) return upper;
  return value;
}
