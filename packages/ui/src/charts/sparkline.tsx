import { cn } from '../lib/cn';
import {
  CHART_SERIES_COLORS,
  SPARKLINE_HEIGHT,
  SPARKLINE_WIDTH,
} from './chart.constants';
import { resolveChartState } from './lib/aggregate';
import { extent, linePath, xPosition, yPosition } from './lib/scale';
import { Skeleton } from '../feedback/skeleton';

export interface SparklineProps {
  /** Series values in display order; at least two are needed to draw a line. */
  values: readonly number[];
  /** Accessible name, e.g. "Balance trend, 30 days". */
  label: string;
  loading?: boolean | undefined;
  /** Colour intent: positive trend (credit), negative (danger), or neutral balance. */
  tone?: 'positive' | 'negative' | 'neutral' | undefined;
  className?: string | undefined;
}

const TONE_COLORS = {
  positive: 'var(--icb-credit)',
  negative: 'var(--icb-danger)',
  neutral: CHART_SERIES_COLORS.balance,
} as const;

const PAD = 2;
const MIN_POINTS = 2;

/** Trend in words, so direction never depends on line colour alone. */
export function trendOf(values: readonly number[]): 'rising' | 'falling' | 'flat' {
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  if (last > first) return 'rising';
  if (last < first) return 'falling';
  return 'flat';
}

/** Inline trend line for dense layouts — account rows, KPI tiles, table cells. */
export function Sparkline({
  values,
  label,
  loading = false,
  tone = 'neutral',
  className,
}: Readonly<SparklineProps>) {
  const state = resolveChartState(loading, values.length >= MIN_POINTS);
  if (state === 'loading') {
    return <Skeleton className={cn('h-9 w-30', className)} />;
  }
  if (state === 'empty') {
    return (
      <span className={cn('text-xs text-[var(--icb-text-subtle)]', className)}>
        No trend data
      </span>
    );
  }
  const [min, max] = extent(values);
  const points = values.map((value, i) => ({
    x: xPosition(i, values.length, SPARKLINE_WIDTH, PAD),
    y: yPosition(value, { min, max, height: SPARKLINE_HEIGHT, pad: PAD }),
  }));
  const last = points[points.length - 1];
  const color = TONE_COLORS[tone];
  return (
    <svg
      role="img"
      aria-label={`${label}: ${trendOf(values)}`}
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      className={cn('h-9 w-30', className)}
    >
      <path d={linePath(points)} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {last ? <circle cx={last.x} cy={last.y} r={2.5} fill={color} /> : null}
    </svg>
  );
}
