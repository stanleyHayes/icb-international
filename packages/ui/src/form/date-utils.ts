/**
 * Calendar maths for {@link DatePicker} / {@link DateRangePicker}.
 *
 * Dates are plain local-midnight `Date`s; the wire value is an ISO `YYYY-MM-DD` string.
 * This is presentation code — the N8 `ClockService` rule binds the API domain, not the browser.
 */

export const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const FLEXIBLE_DATE_PATTERN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

export const CALENDAR_CELLS = 42;
export const DAYS_IN_WEEK = 7;
export const DEFAULT_WEEK_START = 1; // Monday

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Strict `YYYY-MM-DD` parse. Rejects impossible dates (2026-02-30) by round-trip check. */
export function parseISODate(text: string): Date | null {
  const match = ISO_DATE_PATTERN.exec(text.trim());
  if (match == null) {
    return null;
  }
  const [, year, month, day] = match;
  return buildValidDate(Number(year), Number(month), Number(day));
}

/** Accepts ISO plus the common `dd/mm/yyyy`, `dd.mm.yyyy`, `dd-mm-yyyy` typed forms. */
export function parseFlexibleDate(text: string): Date | null {
  const iso = parseISODate(text);
  if (iso != null) {
    return iso;
  }
  const match = FLEXIBLE_DATE_PATTERN.exec(text.trim());
  if (match == null) {
    return null;
  }
  const [, day, month, year] = match;
  return buildValidDate(Number(year), Number(month), Number(day));
}

function buildValidDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  const roundTrips =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return roundTrips ? date : null;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), monthEnd));
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

/** ISO strings sort chronologically, so range comparison is a string compare. */
export function compareISODates(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/** The 6×7 grid of days covering the month, padded from the previous/next months. */
export function monthGridDays(month: Date, weekStartsOn: number = DEFAULT_WEEK_START): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() - weekStartsOn + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const start = addDays(first, -offset);
  return Array.from({ length: CALENDAR_CELLS }, (_, index) => addDays(start, index));
}

export function isIsoDisabled(iso: string, minIso?: string, maxIso?: string): boolean {
  return (minIso != null && iso < minIso) || (maxIso != null && iso > maxIso);
}

export function monthLabel(month: Date, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month);
}

export interface WeekdayLabel {
  readonly short: string;
  readonly long: string;
}

/** Weekday headers in grid order, e.g. Mon…Sun for `weekStartsOn = 1`. */
export function weekdayLabels(locale = 'en-GB', weekStartsOn = DEFAULT_WEEK_START): WeekdayLabel[] {
  // 2024-01-01 was a Monday, so day 0 + weekStartsOn anchors the requested week start.
  const anchor = new Date(2024, 0, 1);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const day = addDays(anchor, weekStartsOn - 1 + index);
    return {
      short: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day),
      long: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(day),
    };
  });
}
