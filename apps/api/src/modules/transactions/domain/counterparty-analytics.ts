/**
 * Merchant and recurring-charge analytics. Pure grouping math over categorised debit rows the
 * service has already fetched — no clock, no database — so the detection rules stay unit-testable
 * and the service stays an orchestration shell. The rules mirror the client-side derivations in
 * `apps/client/src/features/insights/derive.ts`, deliberately: whichever one answers, the
 * customer sees the same verdict.
 */

/** One settled debit, pre-grouped: who took the money, how it was categorised, and when. */
export interface CounterpartyRow {
  readonly name: string;
  readonly category: string;
  readonly minorUnits: number;
  readonly valueDate: string;
  readonly bookedAt: string;
}

export interface MerchantTotal {
  name: string;
  readonly category: string;
  minorUnits: number;
  transactionCount: number;
}

export interface RecurringCharge {
  readonly name: string;
  readonly category: string;
  /** The most recent charge — the amount the customer should expect next. */
  readonly minorUnits: number;
  readonly occurrences: number;
  readonly lastChargedAt: string;
}

/** A charge must repeat at least this often before the bank calls it recurring. */
export const MIN_RECURRING_OCCURRENCES = 3;
/** Amounts within ±15% of each other count as the same recurring charge. */
export const RECURRING_AMOUNT_TOLERANCE = 0.15;
/** Category trusted outright as recurring — the categoriser already flagged it. */
const SUBSCRIPTIONS_CATEGORY = 'subscriptions';

function groupByName(rows: readonly CounterpartyRow[]): Map<string, CounterpartyRow[]> {
  const groups = new Map<string, CounterpartyRow[]>();
  for (const row of rows) {
    groups.set(row.name, [...(groups.get(row.name) ?? []), row]);
  }
  return groups;
}

/** The top counterparties by total spend, largest first, capped at `limit`. */
export function topCounterparties(
  rows: readonly CounterpartyRow[],
  limit: number,
): MerchantTotal[] {
  const totals = new Map<string, MerchantTotal>();
  for (const row of rows) {
    const existing = totals.get(row.name);
    if (existing) {
      existing.minorUnits += row.minorUnits;
      existing.transactionCount += 1;
    } else {
      totals.set(row.name, {
        name: row.name,
        category: row.category,
        minorUnits: row.minorUnits,
        transactionCount: 1,
      });
    }
  }
  return [...totals.values()].sort((a, b) => b.minorUnits - a.minorUnits).slice(0, limit);
}

/** A group is recurring when categorised as a subscription, or when it repeats across months at a stable amount. */
function looksRecurring(group: readonly CounterpartyRow[]): boolean {
  if (group.some((row) => row.category === SUBSCRIPTIONS_CATEGORY)) return true;
  const months = new Set(group.map((row) => row.valueDate.slice(0, 7)));
  if (months.size < 2) return false;

  const amounts = group.map((row) => row.minorUnits);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min > 0 && (max - min) / min <= RECURRING_AMOUNT_TOLERANCE;
}

function latestOf(group: readonly CounterpartyRow[]): CounterpartyRow {
  let latest = group[0];
  for (const row of group) {
    if (latest === undefined || row.bookedAt > latest.bookedAt) latest = row;
  }
  if (latest === undefined) {
    throw new RecurringInvariantError('recurring group cannot be empty');
  }
  return latest;
}

class RecurringInvariantError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'RecurringInvariantError';
  }
}

/**
 * Charges that repeat: same counterparty, at least MIN_RECURRING_OCCURRENCES times, across at
 * least two calendar months, at a stable amount — or categorised as a subscription outright.
 * Sorted by the expected amount, largest first.
 */
export function detectRecurring(rows: readonly CounterpartyRow[]): RecurringCharge[] {
  const recurring: RecurringCharge[] = [];
  for (const [name, group] of groupByName(rows)) {
    if (group.length < MIN_RECURRING_OCCURRENCES || !looksRecurring(group)) continue;
    const latest = latestOf(group);
    recurring.push({
      name,
      category: latest.category,
      minorUnits: latest.minorUnits,
      occurrences: group.length,
      lastChargedAt: latest.bookedAt,
    });
  }
  return recurring.sort((a, b) => b.minorUnits - a.minorUnits);
}
