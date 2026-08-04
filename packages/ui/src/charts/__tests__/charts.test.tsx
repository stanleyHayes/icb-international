import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BalanceAreaChart, type BalancePoint } from '../balance-area-chart';
import { Gauge } from '../gauge';
import { IncomeExpenseChart, type IncomeExpensePeriod } from '../income-expense-chart';
import { KpiStatTile } from '../kpi-stat-tile';
import { Sparkline, trendOf } from '../sparkline';
import { SpendDonutChart, type SpendSlice } from '../spend-donut-chart';

const BALANCE_POINTS: BalancePoint[] = [
  { date: '2026-01-01', minorUnits: 100_000 },
  { date: '2026-01-15', minorUnits: 125_500 },
  { date: '2026-01-31', minorUnits: 118_250 },
];

const SPEND_SLICES: SpendSlice[] = [
  { category: 'Groceries', minorUnits: 42_000 },
  { category: 'Transport', minorUnits: 18_500 },
  { category: 'Dining', minorUnits: 9_900 },
];

const PERIODS: IncomeExpensePeriod[] = [
  { label: 'Jan', incomeMinorUnits: 320_000, expenseMinorUnits: 210_000 },
  { label: 'Feb', incomeMinorUnits: 320_000, expenseMinorUnits: 245_000 },
];

describe('BalanceAreaChart', () => {
  it('renders the series with an accessible summary and axis dates', () => {
    const html = renderToStaticMarkup(
      <BalanceAreaChart points={BALANCE_POINTS} currency="USD" label="Balance over time" />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('Balance over time: 3 points');
    expect(html).toContain('$1,182.50');
    expect(html).toContain('1 Jan');
    expect(html).toContain('31 Jan');
  });

  it('renders the loading skeleton', () => {
    const html = renderToStaticMarkup(
      <BalanceAreaChart points={[]} currency="USD" label="Balance" loading />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('Balance is loading');
  });

  it('renders the explicit empty state', () => {
    const html = renderToStaticMarkup(
      <BalanceAreaChart
        points={[]}
        currency="USD"
        label="Balance"
        emptyTitle="No balance history"
      />,
    );
    expect(html).toContain('No balance history');
    expect(html).not.toContain('role="img"');
  });
});

describe('SpendDonutChart', () => {
  it('renders slices with text labels, amounts, and percentages', () => {
    const html = renderToStaticMarkup(
      <SpendDonutChart slices={SPEND_SLICES} currency="USD" label="Spend by category" />,
    );
    expect(html).toContain('Groceries');
    expect(html).toContain('Transport');
    expect(html).toContain('$420.00');
    expect(html).toContain('60%');
    expect(html).toContain('$704.00');
  });

  it('overlays hatch patterns so slices are not colour-only', () => {
    const html = renderToStaticMarkup(
      <SpendDonutChart slices={SPEND_SLICES} currency="USD" label="Spend" />,
    );
    expect(html).toContain('<pattern');
    expect(html).toContain('url(#');
  });

  it('renders the explicit empty state when all slices are zero', () => {
    const html = renderToStaticMarkup(
      <SpendDonutChart
        slices={[{ category: 'Fees', minorUnits: 0 }]}
        currency="USD"
        label="Spend"
        emptyTitle="No spending yet"
      />,
    );
    expect(html).toContain('No spending yet');
  });
});

describe('IncomeExpenseChart', () => {
  it('renders both series with a text legend and period labels', () => {
    const html = renderToStaticMarkup(
      <IncomeExpenseChart periods={PERIODS} currency="USD" label="Income vs expenses" />,
    );
    expect(html).toContain('Income');
    expect(html).toContain('Expenses');
    expect(html).toContain('Jan');
    expect(html).toContain('Feb');
    expect(html).toContain('role="img"');
  });

  it('renders the explicit empty state with no periods', () => {
    const html = renderToStaticMarkup(
      <IncomeExpenseChart periods={[]} currency="USD" label="Cash flow" emptyTitle="No cash flow data" />,
    );
    expect(html).toContain('No cash flow data');
  });
});

describe('Sparkline', () => {
  it('renders a line with the trend in words', () => {
    const html = renderToStaticMarkup(<Sparkline values={[1, 3, 2, 5]} label="Balance trend" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('Balance trend: rising');
  });

  it('renders the empty state with fewer than two points', () => {
    const html = renderToStaticMarkup(<Sparkline values={[4]} label="Balance trend" />);
    expect(html).toContain('No trend data');
  });

  it('renders the loading skeleton', () => {
    const html = renderToStaticMarkup(<Sparkline values={[]} label="Balance trend" loading />);
    expect(html).not.toContain('No trend data');
    expect(html).not.toContain('role="img"');
  });

  it('classifies trends from first to last value', () => {
    expect(trendOf([1, 2, 3])).toBe('rising');
    expect(trendOf([3, 2, 1])).toBe('falling');
    expect(trendOf([2, 9, 2])).toBe('flat');
    expect(trendOf([])).toBe('flat');
  });
});

describe('KpiStatTile', () => {
  it('renders the value and a textual delta with direction words', () => {
    const html = renderToStaticMarkup(
      <KpiStatTile
        label="Total spend"
        value={{ minorUnits: 210_000, currency: 'USD' }}
        previousValue={{ minorUnits: 200_000, currency: 'USD' }}
        comparisonBasis="vs last month"
      />,
    );
    expect(html).toContain('Total spend');
    expect(html).toContain('$2,100.00');
    expect(html).toContain('up 5.0%');
    expect(html).toContain('vs last month');
  });

  it('renders the empty state without a value', () => {
    const html = renderToStaticMarkup(<KpiStatTile label="Total spend" emptyText="Nothing this period" />);
    expect(html).toContain('Nothing this period');
  });

  it('announces the loading state', () => {
    const html = renderToStaticMarkup(<KpiStatTile label="Total spend" loading />);
    expect(html).toContain('role="status"');
    expect(html).toContain('Total spend is loading');
  });
});

describe('Gauge', () => {
  it('renders the readout, range ends, and a percentage in the accessible name', () => {
    const html = renderToStaticMarkup(
      <Gauge value={65} max={100} label="Budget used" formatValue={(v) => `${v}%`} />,
    );
    expect(html).toContain('Budget used: 65% of 100% (65%)');
    expect(html).toContain('role="img"');
  });

  it('renders the explicit empty state without a value', () => {
    const html = renderToStaticMarkup(<Gauge max={100} label="Budget used" emptyTitle="No budget set" />);
    expect(html).toContain('No budget set');
  });
});
