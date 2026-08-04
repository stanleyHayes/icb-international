import { formatMoney } from '../lib/format';
import {
  AREA_PAD_BOTTOM,
  AREA_PAD_LEFT,
  AREA_PAD_TOP,
  AXIS_TICK_COUNT,
  BAR_GROUP_GAP_RATIO,
  BAR_INNER_GAP,
  BAR_PAD_X,
  CHART_DEFAULT_HEIGHT,
  CHART_SERIES_COLORS,
  CHART_VIEWBOX_WIDTH,
} from './chart.constants';
import { ChartPatterns, useChartPatterns } from './chart-patterns';
import { ChartShell } from './chart-shell';
import { resolveChartState } from './lib/aggregate';
import { niceTicks, yPosition } from './lib/scale';

export interface IncomeExpensePeriod {
  /** Short period caption, e.g. "Jan" or "W12". */
  label: string;
  incomeMinorUnits: number;
  expenseMinorUnits: number;
}

export interface IncomeExpenseChartProps {
  periods: readonly IncomeExpensePeriod[];
  currency: string;
  label: string;
  loading?: boolean | undefined;
  height?: number | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  className?: string | undefined;
}

const SERIES = [
  { key: 'income', caption: 'Income', color: CHART_SERIES_COLORS.income },
  { key: 'expense', caption: 'Expenses', color: CHART_SERIES_COLORS.expense },
] as const;

interface BarGeom {
  groupWidth: number;
  barWidth: number;
  max: number;
  plotHeight: number;
}

function geometry(periodCount: number, maxValue: number, height: number): BarGeom {
  const plotWidth = CHART_VIEWBOX_WIDTH - AREA_PAD_LEFT - BAR_PAD_X;
  const groupWidth = plotWidth / Math.max(periodCount, 1);
  return {
    groupWidth,
    barWidth: (groupWidth * (1 - BAR_GROUP_GAP_RATIO)) / SERIES.length - BAR_INNER_GAP,
    max: niceTicks(maxValue, AXIS_TICK_COUNT).at(-1) ?? maxValue,
    plotHeight: height - AREA_PAD_TOP - AREA_PAD_BOTTOM,
  };
}

function valueOf(period: IncomeExpensePeriod, key: (typeof SERIES)[number]['key']): number {
  return key === 'income' ? period.incomeMinorUnits : period.expenseMinorUnits;
}

/** Accessible summary, e.g. "Cash flow: Jan income $3,200.00, expenses $2,100.00; …". */
function periodSummary(label: string, periods: readonly IncomeExpensePeriod[], currency: string): string {
  const parts = periods.map((p) => {
    const income = formatMoney({ minorUnits: p.incomeMinorUnits, currency });
    const expenses = formatMoney({ minorUnits: p.expenseMinorUnits, currency });
    return `${p.label} income ${income}, expenses ${expenses}`;
  });
  return `${label}: ${parts.join('; ')}`;
}

/**
 * Income vs expenses per period, grouped bars. Income is solid, expenses hatched, with a text
 * legend naming both series — the chart still reads in monochrome.
 */
export function IncomeExpenseChart({
  periods,
  currency,
  label,
  loading = false,
  height = CHART_DEFAULT_HEIGHT,
  emptyTitle,
  emptyDescription,
  className,
}: Readonly<IncomeExpenseChartProps>) {
  const state = resolveChartState(loading, periods.length > 0);
  const { prefix, fillFor } = useChartPatterns();
  const maxValue = Math.max(0, ...periods.flatMap((p) => [p.incomeMinorUnits, p.expenseMinorUnits]));
  const { groupWidth, barWidth, max, plotHeight } = geometry(periods.length, maxValue, height);
  const baseY = AREA_PAD_TOP + plotHeight;

  return (
    <ChartShell state={state} label={label} height={height} emptyTitle={emptyTitle} emptyDescription={emptyDescription} className={className}>
      <figure aria-label={label} className="m-0">
        <figcaption className="mb-2 flex gap-4 text-sm">
          {SERIES.map((series, i) => (
            <span key={series.key} className="flex items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3">
                <rect width={12} height={12} rx={2} fill={series.color} />
                <rect width={12} height={12} rx={2} fill={fillFor(i)} />
              </svg>
              {series.caption}
            </span>
          ))}
        </figcaption>
        <svg role="img" aria-label={periodSummary(label, periods, currency)} viewBox={`0 0 ${CHART_VIEWBOX_WIDTH} ${height}`} className="h-auto w-full">
          <ChartPatterns prefix={prefix} count={SERIES.length} />
          <line x1={AREA_PAD_LEFT} x2={CHART_VIEWBOX_WIDTH - BAR_PAD_X} y1={baseY} y2={baseY} stroke="var(--icb-border-strong)" />
          {periods.map((period, groupIndex) => (
            <g key={period.label}>
              {SERIES.map((series, seriesIndex) => {
                const value = valueOf(period, series.key);
                const y = yPosition(value, { min: 0, max, height: plotHeight, pad: 0 }) + AREA_PAD_TOP;
                const x = AREA_PAD_LEFT + groupIndex * groupWidth + (groupWidth * BAR_GROUP_GAP_RATIO) / 2 + seriesIndex * (barWidth + BAR_INNER_GAP);
                return (
                  <g key={series.key}>
                    <rect x={x} y={y} width={barWidth} height={baseY - y} rx={3} fill={series.color} />
                    <rect x={x} y={y} width={barWidth} height={baseY - y} rx={3} fill={fillFor(seriesIndex)} />
                  </g>
                );
              })}
              <text x={AREA_PAD_LEFT + groupIndex * groupWidth + groupWidth / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--icb-text-subtle)">
                {period.label}
              </text>
            </g>
          ))}
        </svg>
      </figure>
    </ChartShell>
  );
}
