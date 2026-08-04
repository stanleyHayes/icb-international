import {
  CHART_SERIES_COLORS,
  GAUGE_HEIGHT,
  GAUGE_START_DEGREES,
  GAUGE_SWEEP_DEGREES,
  GAUGE_WIDTH,
} from './chart.constants';
import { ChartShell } from './chart-shell';
import { resolveChartState } from './lib/aggregate';
import { arcPath } from './lib/scale';

export interface GaugeProps {
  /** Current value; omit (with `loading` false) for the explicit empty state. */
  value?: number | undefined;
  min?: number | undefined;
  max: number;
  label: string;
  /** Formats the centre readout and the min/max captions (e.g. percent or currency). */
  formatValue?: ((value: number) => string) | undefined;
  loading?: boolean | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  className?: string | undefined;
}

const TRACK_RADIUS = 96;
const TRACK_WIDTH = 18;
const CENTER_X = GAUGE_WIDTH / 2;
const CENTER_Y = GAUGE_HEIGHT - 8;
const PERCENT = 100;

/** Clamp `value` into [min, max] and express it as a 0–1 ratio of the range. */
export function gaugeRatio(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

/**
 * Semicircle gauge for utilisation-style metrics (budget spent, limit used). The number is
 * printed in the middle and the range at both ends, so the arc is decoration, not data.
 */
export function Gauge({
  value,
  min = 0,
  max,
  label,
  formatValue = String,
  loading = false,
  emptyTitle,
  emptyDescription,
  className,
}: Readonly<GaugeProps>) {
  const state = resolveChartState(loading, value !== undefined);
  const ratio = gaugeRatio(value ?? min, min, max);
  const center = { x: CENTER_X, y: CENTER_Y };
  const sweepEnd = GAUGE_START_DEGREES + ratio * GAUGE_SWEEP_DEGREES;
  const track = arcPath(center, TRACK_RADIUS, GAUGE_START_DEGREES, GAUGE_START_DEGREES + GAUGE_SWEEP_DEGREES);
  const fill = arcPath(center, TRACK_RADIUS, GAUGE_START_DEGREES, sweepEnd);

  return (
    <ChartShell state={state} label={label} height={GAUGE_HEIGHT} emptyTitle={emptyTitle} emptyDescription={emptyDescription} className={className}>
      <figure aria-label={label} className="m-0 inline-flex flex-col items-center">
        <svg
          role="img"
          aria-label={`${label}: ${formatValue(value ?? min)} of ${formatValue(max)} (${Math.round(ratio * PERCENT)}%)`}
          viewBox={`0 0 ${GAUGE_WIDTH} ${GAUGE_HEIGHT}`}
          className="h-auto w-60"
        >
          <path d={track} fill="none" stroke={CHART_SERIES_COLORS.gaugeTrack} strokeWidth={TRACK_WIDTH} strokeLinecap="round" />
          {ratio > 0 ? (
            <path d={fill} fill="none" stroke={CHART_SERIES_COLORS.balance} strokeWidth={TRACK_WIDTH} strokeLinecap="round" />
          ) : null}
          <text x={CENTER_X} y={CENTER_Y - 16} textAnchor="middle" fontSize={22} fontWeight={600} fill="var(--icb-text)" className="tabular">
            {formatValue(value ?? min)}
          </text>
          <text x={CENTER_X} y={CENTER_Y + 2} textAnchor="middle" fontSize={11} fill="var(--icb-text-subtle)">
            {label}
          </text>
          <text x={CENTER_X - TRACK_RADIUS} y={CENTER_Y + 16} textAnchor="middle" fontSize={11} fill="var(--icb-text-subtle)">
            {formatValue(min)}
          </text>
          <text x={CENTER_X + TRACK_RADIUS} y={CENTER_Y + 16} textAnchor="middle" fontSize={11} fill="var(--icb-text-subtle)">
            {formatValue(max)}
          </text>
        </svg>
      </figure>
    </ChartShell>
  );
}
