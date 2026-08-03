/**
 * Balance-history bucketing.
 *
 * The ledger is the only record of value; a chart of "what did the account hold on each day" is
 * derived, never stored. Given an account's entries (each carrying a `valueDate` and the signed
 * effect on the account's balance), this folds them into closing balances per day, ISO week
 * (ending Sunday), or calendar month. Entries before the range become its opening balance, so
 * the first point of any window is still correct.
 */

export type HistoryGranularity = 'day' | 'week' | 'month';

export interface ValueDatedEntry {
  /** ISO calendar date (`YYYY-MM-DD`) the entry values on. */
  readonly valueDate: string;
  /** Signed effect on this account's balance, in minor units. */
  readonly signedMinorUnits: number;
}

export interface ClosingPoint {
  /** ISO date the bucket closes on — the day, the Sunday, or the month's last day. */
  readonly date: string;
  readonly closingMinorUnits: number;
}

const MS_PER_DAY = 86_400_000;

function toIso(day: Date): string {
  return day.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  return toIso(new Date(Date.parse(`${isoDate}T00:00:00.000Z`) + days * MS_PER_DAY));
}

/** Last day of the calendar month containing `isoDate`. */
function monthEnd(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00.000Z`);
  return toIso(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)));
}

/** Sunday of the ISO week containing `isoDate` (the week runs Monday → Sunday). */
function weekEnd(isoDate: string): string {
  const day = new Date(`${isoDate}T00:00:00.000Z`);
  return addDays(isoDate, (7 - day.getUTCDay()) % 7);
}

/** The first bucket end at or after `from`. */
function firstBucketEnd(from: string, granularity: HistoryGranularity): string {
  if (granularity === 'week') return weekEnd(from);
  if (granularity === 'month') return monthEnd(from);
  return from;
}

/** The next bucket end strictly after the current one. */
function nextBucketEnd(current: string, granularity: HistoryGranularity): string {
  if (granularity === 'week') return addDays(current, 7);
  if (granularity === 'month') return monthEnd(addDays(current, 1));
  return addDays(current, 1);
}

/**
 * Fold entries into closing balances over `[from, to]` (inclusive ISO dates).
 *
 * One point per bucket, including buckets with no activity — a chart with gaps where nothing
 * happened implies the balance was unknown rather than unchanged.
 */
export function bucketClosingBalances(
  entries: readonly ValueDatedEntry[],
  from: string,
  to: string,
  granularity: HistoryGranularity,
): ClosingPoint[] {
  const sorted = sortedWithinWindow(entries, to);
  const opening = openingBalance(sorted, from);
  return buildPoints(sorted, opening, from, to, granularity);
}

/** Entries valued inside or before the window, in value-date order. */
function sortedWithinWindow(
  entries: readonly ValueDatedEntry[],
  to: string,
): ValueDatedEntry[] {
  return entries
    .filter((entry) => entry.valueDate <= to)
    .toSorted((a, b) => a.valueDate.localeCompare(b.valueDate));
}

/** The sum of everything before the window, and how many entries produced it. */
function openingBalance(
  sorted: readonly ValueDatedEntry[],
  from: string,
): { balance: number; consumed: number } {
  let balance = 0;
  let consumed = 0;
  while (consumed < sorted.length && (sorted[consumed]?.valueDate ?? '') < from) {
    balance += sorted[consumed]?.signedMinorUnits ?? 0;
    consumed += 1;
  }
  return { balance, consumed };
}

/** Walk the buckets, carrying the running close forward across quiet stretches. */
function buildPoints(
  sorted: readonly ValueDatedEntry[],
  opening: { balance: number; consumed: number },
  from: string,
  to: string,
  granularity: HistoryGranularity,
): ClosingPoint[] {
  const points: ClosingPoint[] = [];
  let balance = opening.balance;
  let cursor = opening.consumed;

  for (let end = firstBucketEnd(from, granularity); ; end = nextBucketEnd(end, granularity)) {
    const capped = end > to ? to : end;
    while (cursor < sorted.length && (sorted[cursor]?.valueDate ?? '') <= capped) {
      balance += sorted[cursor]?.signedMinorUnits ?? 0;
      cursor += 1;
    }
    points.push({ date: capped, closingMinorUnits: balance });
    if (capped >= to) break;
  }
  return points;
}
