/**
 * Analytics math for the insights endpoints. Pure date/category arithmetic over rows the
 * service has already fetched and categorised — no clock, no database — so the bucketing is
 * unit-testable and the service stays an orchestration shell.
 */

export interface SpendRow {
  readonly category: string;
  readonly minorUnits: number;
}

export interface CategorySpend {
  readonly category: string;
  readonly minorUnits: number;
  readonly share: number;
  readonly transactionCount: number;
  /** (current − previous) / previous; null when the previous period had nothing here. */
  readonly changeFromPreviousPeriod: number | null;
}

export interface CashflowRow {
  readonly valueDate: string;
  readonly direction: 'debit' | 'credit';
  readonly minorUnits: number;
}

export interface CashflowPointMinorUnits {
  readonly period: string;
  readonly incomeMinorUnits: number;
  readonly expenseMinorUnits: number;
  readonly netMinorUnits: number;
}

export type Granularity = 'week' | 'month';

const DAY_MS = 86_400_000;

/** `[today − days + 1, today]` as ISO dates — the window when the caller gave none. */
export function trailingWindow(today: string, days: number): { from: string; to: string } {
  const toMs = Date.parse(`${today}T00:00:00Z`);
  const from = new Date(toMs - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  return { from, to: today };
}

/** The window of identical length immediately before `[from, to]`, for period-over-period. */
export function previousWindow(from: string, to: string): { from: string; to: string } {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  const length = toMs - fromMs + DAY_MS;
  return {
    from: new Date(fromMs - length).toISOString().slice(0, 10),
    to: new Date(toMs - length).toISOString().slice(0, 10),
  };
}

/** Groups spend by category, computes shares, and diffs against the previous window. */
export function summariseSpend(
  current: readonly SpendRow[],
  previous: readonly SpendRow[],
): CategorySpend[] {
  const previousTotals = totalsByCategory(previous);
  const currentTotals = totalsByCategory(current);
  const grandTotal = [...currentTotals.values()].reduce((sum, row) => sum + row.minorUnits, 0);

  return [...currentTotals.entries()]
    .map(([category, row]) => {
      const before = previousTotals.get(category)?.minorUnits ?? 0;
      return {
        category,
        minorUnits: row.minorUnits,
        share: grandTotal > 0 ? row.minorUnits / grandTotal : 0,
        transactionCount: row.transactionCount,
        changeFromPreviousPeriod: before > 0 ? (row.minorUnits - before) / before : null,
      };
    })
    .sort((left, right) => right.minorUnits - left.minorUnits);
}

function totalsByCategory(
  rows: readonly SpendRow[],
): Map<string, { minorUnits: number; transactionCount: number }> {
  const totals = new Map<string, { minorUnits: number; transactionCount: number }>();
  for (const row of rows) {
    const entry = totals.get(row.category) ?? { minorUnits: 0, transactionCount: 0 };
    entry.minorUnits += row.minorUnits;
    entry.transactionCount += 1;
    totals.set(row.category, entry);
  }
  return totals;
}

/** The bucket a value date belongs to: `YYYY-MM`, or the Monday of its week as ISO date. */
export function bucketKey(valueDate: string, granularity: Granularity): string {
  if (granularity === 'month') {
    return valueDate.slice(0, 7);
  }
  const date = new Date(Date.parse(`${valueDate}T00:00:00Z`));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - mondayOffset * DAY_MS).toISOString().slice(0, 10);
}

/** The `count` buckets ending in the one containing `today`, oldest first. */
export function bucketSeries(today: string, granularity: Granularity, count: number): string[] {
  const current = bucketKey(today, granularity);
  const series = [current];

  for (let index = 1; index < count; index += 1) {
    const previous =
      granularity === 'month' ? shiftMonth(series[0] ?? current, -1) : shiftDay(series[0] ?? current, -7);
    series.unshift(previous);
  }

  return series;
}

/** First day of the window the series covers — the `$gte` bound for the aggregation. */
export function seriesStart(series: readonly string[], granularity: Granularity): string {
  const first = series[0] ?? '';
  return granularity === 'month' ? `${first}-01` : first;
}

/** Folds daily rows into one point per bucket. Missing buckets come back as zeros. */
export function buildCashflowPoints(
  rows: readonly CashflowRow[],
  periods: readonly string[],
  granularity: Granularity,
): CashflowPointMinorUnits[] {
  const byPeriod = new Map<string, { income: number; expense: number }>();

  for (const row of rows) {
    const key = bucketKey(row.valueDate, granularity);
    const entry = byPeriod.get(key) ?? { income: 0, expense: 0 };
    if (row.direction === 'credit') {
      entry.income += row.minorUnits;
    } else {
      entry.expense += row.minorUnits;
    }
    byPeriod.set(key, entry);
  }

  return periods.map((period) => {
    const entry = byPeriod.get(period) ?? { income: 0, expense: 0 };
    return {
      period,
      incomeMinorUnits: entry.income,
      expenseMinorUnits: entry.expense,
      netMinorUnits: entry.income - entry.expense,
    };
  });
}

function shiftMonth(period: string, delta: number): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1 + delta;
  const shifted = new Date(Date.UTC(year, month, 1));
  return shifted.toISOString().slice(0, 7);
}

function shiftDay(isoDate: string, delta: number): string {
  const shifted = new Date(Date.parse(`${isoDate}T00:00:00Z`) + delta * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}
