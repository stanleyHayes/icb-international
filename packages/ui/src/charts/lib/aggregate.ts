/**
 * Pure data-mapping for charts: time bucketing, category rollups, and the
 * loading/empty/ready selection every chart shares. No React, no DOM.
 */

import { OTHER_CATEGORY_LABEL } from '../chart.constants';

export const CHART_STATES = ['loading', 'empty', 'ready'] as const;
export type ChartState = (typeof CHART_STATES)[number];

/** Single source of truth for which face a chart shows. */
export function resolveChartState(loading: boolean, hasData: boolean): ChartState {
  if (loading) return 'loading';
  return hasData ? 'ready' : 'empty';
}

export interface TimeSeriesPoint {
  /** ISO 8601 date or datetime. */
  date: string;
  value: number;
}

export interface TimeBucket {
  /** Bucket start, ISO date (yyyy-mm-dd). */
  key: string;
  /** Last value observed inside the bucket — balance semantics, not a sum. */
  value: number;
}

export const BUCKET_GRANULARITIES = ['day', 'week', 'month'] as const;
export type BucketGranularity = (typeof BUCKET_GRANULARITIES)[number];

const DAY_MS = 86_400_000;

function bucketKey(date: Date, granularity: BucketGranularity): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (granularity === 'month') return `${year}-${month}`;
  if (granularity === 'week') {
    const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS);
    return bucketKey(monday, 'day');
  }
  return `${year}-${month}-${day}`;
}

/**
 * Collapse a time series into buckets, keeping the last value per bucket
 * (a balance at period end, not a flow sum). Input may be unordered; output
 * is sorted by bucket key. Unparseable dates are dropped.
 */
export function bucketTimeSeries(
  points: readonly TimeSeriesPoint[],
  granularity: BucketGranularity,
): TimeBucket[] {
  const byBucket = new Map<string, { time: number; value: number }>();
  for (const point of points) {
    const time = Date.parse(point.date);
    if (Number.isNaN(time)) continue;
    const key = bucketKey(new Date(time), granularity);
    const current = byBucket.get(key);
    if (!current || time >= current.time) byBucket.set(key, { time, value: point.value });
  }
  return [...byBucket.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => ({ key, value: entry.value }));
}

export interface CategorySlice {
  category: string;
  value: number;
}

/**
 * Keep the largest `maxSlices - 1` categories and fold the rest into "Other",
 * so a donut stays readable when a customer has dozens of spend categories.
 * Slices with non-positive values are dropped. Output is sorted descending.
 */
export function rollupCategories(
  slices: readonly CategorySlice[],
  maxSlices: number,
): CategorySlice[] {
  const positive = slices
    .filter((slice) => slice.value > 0)
    .toSorted((a, b) => b.value - a.value);
  if (positive.length <= maxSlices) return positive;
  const kept = positive.slice(0, Math.max(maxSlices - 1, 1));
  const rest = positive.slice(Math.max(maxSlices - 1, 1));
  const otherTotal = rest.reduce((total, slice) => total + slice.value, 0);
  return [...kept, { category: OTHER_CATEGORY_LABEL, value: otherTotal }];
}

/** Share of each slice as a percentage of the total; zeros when the total is zero. */
export function slicePercents(slices: readonly CategorySlice[]): number[] {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return slices.map((slice) => (total === 0 ? 0 : (slice.value / total) * 100));
}

/** Signed percent change from `previous` to `current`; null when undefined (previous ≤ 0). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
