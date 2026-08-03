import type { TransferSchedule } from '@icb/contracts';

import { InvalidScheduleError } from './transfer-errors.js';

/**
 * RRULE recurrence — deliberately a subset.
 *
 * RFC 5545 in full is a library, not a feature; a bank's standing orders need daily, weekly and
 * monthly repetition with an interval and an end condition, and nothing else. Anything outside
 * this subset is rejected at parse time rather than silently mis-scheduled.
 */

export const SUPPORTED_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type RecurrenceFrequency = (typeof SUPPORTED_FREQUENCIES)[number];

export interface RecurrenceRule {
  readonly freq: RecurrenceFrequency;
  readonly interval: number;
  readonly count: number | null;
  readonly until: Date | null;
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
/** Bound on the scan for the next occurrence — far past any legitimate gap. */
const MAX_SCAN_OCCURRENCES = 1_000;

/** Parse `FREQ=WEEKLY;INTERVAL=2;COUNT=10` into a rule, rejecting anything outside the subset. */
export function parseRRule(rrule: string): RecurrenceRule {
  const parts = new Map(
    rrule.split(';').map((part) => {
      const [key = '', value = ''] = part.split('=');
      return [key.trim().toUpperCase(), value.trim().toUpperCase()] as const;
    }),
  );

  const freq = parts.get('FREQ') as RecurrenceFrequency | undefined;
  if (!freq || !SUPPORTED_FREQUENCIES.includes(freq)) {
    throw new InvalidScheduleError(`FREQ must be one of ${SUPPORTED_FREQUENCIES.join(', ')}`);
  }

  return {
    freq,
    interval: parseInterval(parts.get('INTERVAL')),
    count: parsePositiveInt(parts.get('COUNT'), 'COUNT'),
    until: parseUntil(parts.get('UNTIL')),
  };
}

function parseInterval(raw: string | undefined): number {
  if (raw === undefined) {
    return 1;
  }
  const interval = parsePositiveInt(raw, 'INTERVAL');
  if (interval === null) {
    throw new InvalidScheduleError('INTERVAL must be a positive integer');
  }
  return interval;
}

function parsePositiveInt(raw: string | undefined, key: string): number | null {
  if (raw === undefined) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new InvalidScheduleError(`${key} must be a positive integer`);
  }
  return value;
}

function parseUntil(raw: string | undefined): Date | null {
  if (raw === undefined) {
    return null;
  }
  const compact = raw.replaceAll('-', '').replaceAll(':', '');
  const match = /^(\d{8})(T(\d{6})Z?)?$/.exec(compact);
  if (!match) {
    throw new InvalidScheduleError('UNTIL must be YYYYMMDD or YYYYMMDDTHHMMSSZ');
  }
  const datePart = match[1] ?? '';
  const timePart = match[3] ?? '235959';
  const instant = new Date(
    `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}` +
      `T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}.000Z`,
  );
  if (Number.isNaN(instant.getTime())) {
    throw new InvalidScheduleError('UNTIL is not a real date');
  }
  return instant;
}

/**
 * The k-th occurrence (0-based) of a rule anchored at `startsOn`, at midnight UTC.
 *
 * Monthly repetition keeps the day of month where it exists (Jan 31 + 1 month clamps to the
 * short month's last day via Date overflow correction).
 */
export function occurrenceAt(rule: RecurrenceRule, startsOn: string, index: number): Date {
  const start = new Date(`${startsOn}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    throw new InvalidScheduleError('startsOn is not a real date');
  }
  const step = rule.interval * index;
  switch (rule.freq) {
    case 'DAILY':
      return new Date(start.getTime() + step * MS_PER_DAY);
    case 'WEEKLY':
      return new Date(start.getTime() + step * DAYS_PER_WEEK * MS_PER_DAY);
    case 'MONTHLY':
      return addMonths(start, step);
  }
}

function addMonths(start: Date, months: number): Date {
  const day = start.getUTCDate();
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastOfMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastOfMonth)),
  );
}

/**
 * The first occurrence strictly after `after`, or null when the series has ended.
 *
 * The end conditions are whichever bites first: the RRULE's own COUNT/UNTIL, the schedule's
 * `endsOn`, or its `maxOccurrences` cap.
 */
export function nextOccurrence(
  rule: RecurrenceRule,
  schedule: TransferSchedule,
  after: Date,
): Date | null {
  const endMs = endOfSeries(rule, schedule);
  const cap = Math.min(
    rule.count ?? Number.MAX_SAFE_INTEGER,
    schedule.maxOccurrences ?? Number.MAX_SAFE_INTEGER,
  );

  for (let index = 0; index < Math.min(cap, MAX_SCAN_OCCURRENCES); index += 1) {
    const occurrence = occurrenceAt(rule, schedule.startsOn, index);
    if (occurrence.getTime() > endMs) {
      return null;
    }
    if (occurrence.getTime() > after.getTime()) {
      return occurrence;
    }
  }
  return null;
}

/** The instant past which no occurrence may fall. */
function endOfSeries(rule: RecurrenceRule, schedule: TransferSchedule): number {
  const ends = [rule.until?.getTime() ?? Number.MAX_SAFE_INTEGER];
  if (schedule.endsOn) {
    // Inclusive: an occurrence on the end date itself still runs.
    ends.push(new Date(`${schedule.endsOn}T23:59:59.999Z`).getTime());
  }
  return Math.min(...ends);
}
