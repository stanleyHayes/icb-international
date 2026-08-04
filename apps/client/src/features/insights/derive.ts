import type { TransactionSummary } from '@icb/contracts';

/**
 * Pure derivations over the transaction feed for the insights screen.
 *
 * Merchant and subscription aggregates are computed here rather than by a dedicated endpoint
 * (none exists yet — see contract request) from the same transaction list the customer sees, so
 * the numbers can never disagree with the feed.
 */

export interface MerchantTotal {
  name: string;
  category: string;
  totalMinorUnits: number;
  transactionCount: number;
}

export interface RecurringCharge {
  name: string;
  category: string;
  amountMinorUnits: number;
  currency: string;
  occurrences: number;
  lastChargedAt: string;
}

export interface CashflowProjection {
  averageNetMinorUnits: number;
  projectedMinorUnits: number;
  monthsProjected: number;
}

const MERCHANT_LEADERBOARD_SIZE = 5;
const MIN_RECURRING_OCCURRENCES = 3;
/** Amounts within ±15% count as the same recurring charge. */
const RECURRING_AMOUNT_TOLERANCE = 0.15;
const PROJECTION_MONTHS = 3;

function counterpartyName(transaction: TransactionSummary): string {
  return transaction.merchant?.name ?? transaction.counterparty?.name ?? transaction.description;
}

/** The top debit counterparties by total spend over the fetched window. */
export function topMerchants(transactions: readonly TransactionSummary[]): MerchantTotal[] {
  const totals = new Map<string, MerchantTotal>();
  for (const transaction of transactions) {
    if (transaction.direction !== 'debit') continue;
    const name = counterpartyName(transaction);
    const existing = totals.get(name);
    if (existing) {
      existing.totalMinorUnits += transaction.amount.minorUnits;
      existing.transactionCount += 1;
    } else {
      totals.set(name, {
        name,
        category: transaction.category,
        totalMinorUnits: transaction.amount.minorUnits,
        transactionCount: 1,
      });
    }
  }
  return [...totals.values()]
    .sort((a, b) => b.totalMinorUnits - a.totalMinorUnits)
    .slice(0, MERCHANT_LEADERBOARD_SIZE);
}

function monthOf(isoDateTime: string): string {
  return isoDateTime.slice(0, 7);
}

function groupDebitsByName(
  transactions: readonly TransactionSummary[],
): Map<string, TransactionSummary[]> {
  const groups = new Map<string, TransactionSummary[]>();
  for (const transaction of transactions) {
    if (transaction.direction !== 'debit' || transaction.pending) continue;
    const name = counterpartyName(transaction);
    groups.set(name, [...(groups.get(name) ?? []), transaction]);
  }
  return groups;
}

/** A group looks recurring when it is categorised as a subscription, or repeats across months at a stable amount. */
function looksRecurring(group: readonly TransactionSummary[]): boolean {
  const categorised = group.some((t) => t.category === 'subscriptions');
  if (categorised) return true;
  const months = new Set(group.map((t) => monthOf(t.bookedAt)));
  if (months.size < 2) return false;

  const amounts = group.map((t) => t.amount.minorUnits);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min > 0 && (max - min) / min <= RECURRING_AMOUNT_TOLERANCE;
}

function latestOf(group: readonly TransactionSummary[]): TransactionSummary {
  let latest = group[0];
  for (const transaction of group) {
    if (latest === undefined || transaction.bookedAt > latest.bookedAt) latest = transaction;
  }
  if (latest === undefined) throw new InsightsInvariantError('recurring group cannot be empty');
  return latest;
}

class InsightsInvariantError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'InsightsInvariantError';
  }
}

/**
 * Charges that repeat: same counterparty, at least three times, across at least two calendar
 * months, at a stable amount. Category 'subscriptions' is trusted outright when the bank's
 * categoriser has already flagged it.
 */
export function detectRecurringCharges(
  transactions: readonly TransactionSummary[],
): RecurringCharge[] {
  const recurring: RecurringCharge[] = [];
  for (const [name, group] of groupDebitsByName(transactions)) {
    if (group.length < MIN_RECURRING_OCCURRENCES || !looksRecurring(group)) continue;

    const latest = latestOf(group);
    recurring.push({
      name,
      category: latest.category,
      amountMinorUnits: latest.amount.minorUnits,
      currency: latest.amount.currency,
      occurrences: group.length,
      lastChargedAt: latest.bookedAt,
    });
  }
  return recurring.sort((a, b) => b.amountMinorUnits - a.amountMinorUnits);
}

/** Average net cashflow carried forward: today's position plus the average month, repeated. */
export function projectCashflow(
  points: ReadonlyArray<{ net: { minorUnits: number } }>,
  currentMinorUnits: number,
): CashflowProjection | null {
  if (points.length === 0) return null;
  const totalNet = points.reduce((sum, point) => sum + point.net.minorUnits, 0);
  const averageNetMinorUnits = Math.round(totalNet / points.length);
  return {
    averageNetMinorUnits,
    projectedMinorUnits: currentMinorUnits + averageNetMinorUnits * PROJECTION_MONTHS,
    monthsProjected: PROJECTION_MONTHS,
  };
}

/** "2026-07" → "Jul"; week buckets ("2026-W31") pass through unchanged. */
export function periodLabel(period: string): string {
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(period);
  if (!monthMatch) return period;
  const month = Number(monthMatch[2]);
  const date = new Date(Date.UTC(Number(monthMatch[1]), month - 1, 1));
  return date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
}
