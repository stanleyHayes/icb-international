import { formatDate, formatMoney } from '../lib/format';
import { cn } from '../lib/cn';
import {
  AREA_PAD_BOTTOM,
  AREA_PAD_LEFT,
  AREA_PAD_TOP,
  AREA_PAD_X,
  AXIS_TICK_COUNT,
  CHART_DEFAULT_HEIGHT,
  CHART_SERIES_COLORS,
  CHART_VIEWBOX_WIDTH,
} from './chart.constants';
import { ChartShell } from './chart-shell';
import { resolveChartState } from './lib/aggregate';
import { areaPath, extent, linePath, niceTicks, xPosition, yPosition } from './lib/scale';

export interface BalancePoint {
  /** ISO 8601 date or datetime. */
  date: string;
  /** Balance in minor units at that instant. */
  minorUnits: number;
}

export interface BalanceAreaChartProps {
  points: readonly BalancePoint[];
  currency: string;
  label: string;
  loading?: boolean | undefined;
  height?: number | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  className?: string | undefined;
}

interface Plotted {
  xs: number[];
  ys: number[];
  ticks: number[];
  baseY: number;
  innerHeight: number;
}

function plot(points: readonly BalancePoint[], height: number): Plotted {
  const values = points.map((p) => p.minorUnits);
  const [, rawMax] = extent(values);
  const ticks = niceTicks(rawMax, AXIS_TICK_COUNT);
  const max = ticks[ticks.length - 1] ?? rawMax;
  const innerHeight = height - AREA_PAD_TOP - AREA_PAD_BOTTOM;
  const plotWidth = CHART_VIEWBOX_WIDTH - AREA_PAD_LEFT;
  const domain = { min: 0, max, height: innerHeight + AREA_PAD_TOP * 2, pad: AREA_PAD_TOP };
  const baseY = yPosition(0, domain);
  const xs = points.map((_, i) => AREA_PAD_LEFT + xPosition(i, points.length, plotWidth, AREA_PAD_X));
  const ys = values.map((v) => yPosition(v, domain));
  return { xs, ys, ticks, baseY, innerHeight };
}

function YAxis({ ticks, max, height, currency }: Readonly<{ ticks: number[]; max: number; height: number; currency: string }>) {
  return (
    <g aria-hidden="true">
      {ticks.map((tick) => {
        const y = yPosition(tick, { min: 0, max, height, pad: AREA_PAD_TOP });
        return (
          <g key={tick}>
            <line x1={AREA_PAD_LEFT} x2={CHART_VIEWBOX_WIDTH} y1={y} y2={y} stroke="var(--icb-border)" strokeDasharray="2 4" />
            <text x={AREA_PAD_LEFT - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--icb-text-subtle)">
              {formatMoney({ minorUnits: tick, currency }, { display: 'none' })}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Balance over time. A filled area, never a bare line — magnitude matters for a balance. */
export function BalanceAreaChart({
  points,
  currency,
  label,
  loading = false,
  height = CHART_DEFAULT_HEIGHT,
  emptyTitle,
  emptyDescription,
  className,
}: Readonly<BalanceAreaChartProps>) {
  const state = resolveChartState(loading, points.length > 0);
  const { xs, ys, ticks, baseY } = plot(points, height);
  const max = ticks[ticks.length - 1] ?? 0;
  const coords = xs.map((x, i) => ({ x, y: ys[i] ?? baseY }));
  const last = points[points.length - 1];
  const first = points[0];
  const plotHeight = height - AREA_PAD_TOP - AREA_PAD_BOTTOM;

  return (
    <ChartShell state={state} label={label} height={height} emptyTitle={emptyTitle} emptyDescription={emptyDescription} className={className}>
      <figure aria-label={label} className="m-0">
        {last ? (
          <figcaption className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-[var(--icb-text-muted)]">{label}</span>
            <span className="tabular text-lg font-semibold">{formatMoney({ minorUnits: last.minorUnits, currency })}</span>
          </figcaption>
        ) : null}
        <svg role="img" aria-label={`${label}: ${points.length} points, latest ${last ? formatMoney({ minorUnits: last.minorUnits, currency }) : 'none'}`} viewBox={`0 0 ${CHART_VIEWBOX_WIDTH} ${height}`} className={cn('h-auto w-full')}>
          <YAxis ticks={ticks} max={max} height={plotHeight + AREA_PAD_TOP * 2} currency={currency} />
          <path d={areaPath(coords, baseY)} fill={CHART_SERIES_COLORS.balance} fillOpacity={0.16} />
          <path d={linePath(coords)} fill="none" stroke={CHART_SERIES_COLORS.balance} strokeWidth={2} strokeLinejoin="round" />
          {first && last ? (
            <g aria-hidden="true" fontSize={11} fill="var(--icb-text-subtle)">
              <text x={AREA_PAD_LEFT} y={height - 6}>{formatDate(first.date, 'short')}</text>
              <text x={CHART_VIEWBOX_WIDTH - AREA_PAD_X} y={height - 6} textAnchor="end">{formatDate(last.date, 'short')}</text>
            </g>
          ) : null}
        </svg>
      </figure>
    </ChartShell>
  );
}
