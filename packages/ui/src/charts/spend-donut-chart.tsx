import { formatMoney } from '../lib/format';
import {
  CHART_CATEGORICAL_COLORS,
  CHART_DEFAULT_HEIGHT,
  DONUT_SIZE,
  DONUT_THICKNESS,
  FULL_CIRCLE_DEGREES,
  MAX_DONUT_SLICES,
} from './chart.constants';
import { ChartPatterns, useChartPatterns } from './chart-patterns';
import { ChartShell } from './chart-shell';
import { resolveChartState, rollupCategories, slicePercents } from './lib/aggregate';
import { donutSegmentPath } from './lib/scale';

export interface SpendSlice {
  category: string;
  /** Spend in minor units; non-positive slices are dropped in the rollup. */
  minorUnits: number;
}

export interface SpendDonutChartProps {
  slices: readonly SpendSlice[];
  currency: string;
  label: string;
  loading?: boolean | undefined;
  maxSlices?: number | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  className?: string | undefined;
}

const CENTER = DONUT_SIZE / 2;
const OUTER_RADIUS = CENTER;
const INNER_RADIUS = CENTER - DONUT_THICKNESS;

interface Segment {
  d: string;
  color: string;
}

function buildSegments(values: readonly number[]): Segment[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  let angle = 0;
  return values.map((value, index) => {
    const sweep = total === 0 ? 0 : (value / total) * FULL_CIRCLE_DEGREES;
    const d = donutSegmentPath(
      { x: CENTER, y: CENTER },
      { outer: OUTER_RADIUS, inner: INNER_RADIUS },
      angle,
      angle + sweep,
    );
    angle += sweep;
    return { d, color: CHART_CATEGORICAL_COLORS[index % CHART_CATEGORICAL_COLORS.length] ?? CHART_CATEGORICAL_COLORS[0] };
  });
}

/** Accessible summary, e.g. "Spend by category: Groceries 60%, Transport 26%". */
function sliceSummary(label: string, rolled: readonly { category: string }[], percents: readonly number[]): string {
  const parts = rolled.map((slice, i) => `${slice.category} ${Math.round(percents[i] ?? 0)}%`);
  return `${label}: ${parts.join(', ')}`;
}

/**
 * Spend by category. Each slice carries a hatch texture and a text legend with the amount and
 * percentage — colour is never the only channel.
 */
export function SpendDonutChart({
  slices,
  currency,
  label,
  loading = false,
  maxSlices = MAX_DONUT_SLICES,
  emptyTitle,
  emptyDescription,
  className,
}: Readonly<SpendDonutChartProps>) {
  const rolled = rollupCategories(
    slices.map((s) => ({ category: s.category, value: s.minorUnits })),
    maxSlices,
  );
  const state = resolveChartState(loading, rolled.length > 0);
  const { prefix, fillFor } = useChartPatterns();
  const percents = slicePercents(rolled);
  const segments = buildSegments(rolled.map((s) => s.value));
  const total = rolled.reduce((sum, s) => sum + s.value, 0);

  return (
    <ChartShell state={state} label={label} height={CHART_DEFAULT_HEIGHT} emptyTitle={emptyTitle} emptyDescription={emptyDescription} className={className}>
      <figure aria-label={label} className="m-0 flex flex-wrap items-center gap-6">
        <svg role="img" aria-label={sliceSummary(label, rolled, percents)} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`} className="h-48 w-48 shrink-0">
          <ChartPatterns prefix={prefix} count={rolled.length} />
          {segments.map((segment, i) => (
            <path key={rolled[i]?.category ?? i} d={segment.d} fill={segment.color} />
          ))}
          {segments.map((segment, i) => (
            <path key={`${rolled[i]?.category ?? i}-hatch`} d={segment.d} fill={fillFor(i)} />
          ))}
          <text x={CENTER} y={CENTER - 4} textAnchor="middle" fontSize={12} fill="var(--icb-text-subtle)">Total</text>
          <text x={CENTER} y={CENTER + 16} textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--icb-text)" className="tabular">
            {formatMoney({ minorUnits: total, currency })}
          </text>
        </svg>
        <figcaption className="min-w-40 flex-1">
          <ul className="space-y-1.5 text-sm">
            {rolled.map((slice, i) => (
              <li key={slice.category} className="flex items-center gap-2">
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0">
                  <rect width={12} height={12} rx={2} fill={segments[i]?.color} />
                  <rect width={12} height={12} rx={2} fill={fillFor(i)} />
                </svg>
                <span className="flex-1 truncate">{slice.category}</span>
                <span className="tabular text-[var(--icb-text-muted)]">{Math.round(percents[i] ?? 0)}%</span>
                <span className="tabular font-medium">{formatMoney({ minorUnits: slice.value, currency })}</span>
              </li>
            ))}
          </ul>
        </figcaption>
      </figure>
    </ChartShell>
  );
}
