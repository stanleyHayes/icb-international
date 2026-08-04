import { rateTableSchema, type RateTable } from '@icb/contracts';
import { format, fromMinorUnits } from '@icb/money';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/v1';
export const RATES_REVALIDATE_SECONDS = 3600;

/**
 * A display-ready rates page. Rows are pre-rendered strings so the page component never
 * branches on whether the figures came from the API or the fallback below.
 */
export interface RatesView {
  /** True when every figure came from `GET /products/rates` at build/revalidate time. */
  readonly live: boolean;
  readonly effectiveFrom: string | null;
  readonly savingsRows: readonly (readonly string[])[];
  readonly depositRows: readonly (readonly string[])[];
  readonly loanRows: readonly (readonly string[])[];
  readonly comparisonRows: readonly (readonly string[])[];
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

const BASIS_AER_VARIABLE = 'AER, variable';
const BASIS_REPRESENTATIVE_APR = 'Representative APR';

function termLabel(termMonths: number): string {
  return `${termMonths} ${termMonths === 1 ? 'month' : 'months'}`;
}

/**
 * The static table, shown when the API cannot be reached at build time. Figures here must
 * match the seeded product catalogue — the page looks identical either way, only the
 * `effectiveFrom` line disappears when the source is static.
 */
const FALLBACK_VIEW: RatesView = {
  live: false,
  effectiveFrom: null,
  savingsRows: [
    ['Reserve Savings', 'Any balance', '4.15%', BASIS_AER_VARIABLE],
    ['Reserve Savings', 'Over 50,000', '4.35%', BASIS_AER_VARIABLE],
    ['Everyday Current', 'Any credit balance', '0.25%', BASIS_AER_VARIABLE],
  ],
  depositRows: [
    ['1 month', '500', '3.80%'],
    ['3 months', '500', '4.40%'],
    ['6 months', '1,000', '4.85%'],
    ['12 months', '1,000', '5.20%'],
    ['24 months', '5,000', '5.05%'],
    ['60 months', '10,000', '4.75%'],
  ],
  loanRows: [['Personal loan', 'from 8.90%', 'Representative APR, fixed for the term']],
  comparisonRows: [
    ['Reserve Savings', '4.15%', BASIS_AER_VARIABLE, 'Instant access'],
    ['12-month fixed deposit', '5.20%', 'Fixed for the term', 'Locked 12 months'],
    ['Personal loan', 'from 8.90%', BASIS_REPRESENTATIVE_APR, 'Fixed monthly payments'],
  ],
};

async function fetchRateTable(): Promise<RateTable | null> {
  try {
    const response = await fetch(`${API_URL}/products/rates`, {
      next: { revalidate: RATES_REVALIDATE_SECONDS, tags: ['rates'] },
    });
    if (!response.ok) {
      return null;
    }
    const parsed = rateTableSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    // The API is unreachable at build time (CI, offline) — the page still ships, static.
    return null;
  }
}

function bestSavingsRow(table: RateTable): (readonly string[]) | null {
  const best = table.savings.reduce<RateTable['savings'][number] | null>(
    (top, row) => (top === null || row.rate > top.rate ? row : top),
    null,
  );
  return best === null
    ? null
    : [best.name, formatRate(best.rate), BASIS_AER_VARIABLE, 'Instant access'];
}

function bestDepositRow(table: RateTable): (readonly string[]) | null {
  const twelveMonth =
    table.deposits.find((row) => row.termMonths === 12) ??
    table.deposits.reduce<RateTable['deposits'][number] | null>(
      (top, row) => (top === null || row.rate > top.rate ? row : top),
      null,
    );
  return twelveMonth === null
    ? null
    : [
        `${termLabel(twelveMonth.termMonths)} fixed deposit`,
        formatRate(twelveMonth.rate),
        'Fixed for the term',
        `Locked ${termLabel(twelveMonth.termMonths)}`,
      ];
}

function lowestLoanRow(table: RateTable): (readonly string[]) | null {
  const lowest = table.loans.reduce<RateTable['loans'][number] | null>(
    (top, row) => (top === null || row.fromRate < top.fromRate ? row : top),
    null,
  );
  return lowest === null
    ? null
    : [
        lowest.name,
        `from ${formatRate(lowest.fromRate)}`,
        BASIS_REPRESENTATIVE_APR,
        'Fixed monthly payments',
      ];
}

function toView(table: RateTable): RatesView {
  const orFallback = <T>(live: readonly T[], fallback: readonly T[]): readonly T[] =>
    live.length > 0 ? live : fallback;

  return {
    live: true,
    effectiveFrom: table.effectiveFrom,
    savingsRows: orFallback(
      table.savings.map((row) => [row.name, 'Any balance', formatRate(row.rate), BASIS_AER_VARIABLE]),
      FALLBACK_VIEW.savingsRows,
    ),
    depositRows: orFallback(
      table.deposits.map((row) => [
        termLabel(row.termMonths),
        format(fromMinorUnits(row.minimumAmount.minorUnits, row.minimumAmount.currency), {
          compactZeroFraction: true,
        }),
        formatRate(row.rate),
      ]),
      FALLBACK_VIEW.depositRows,
    ),
    loanRows: orFallback(
      table.loans.map((row) => [
        row.name,
        `${formatRate(row.fromRate)} – ${formatRate(row.toRate)}`,
        'Representative APR, fixed for the term',
      ]),
      FALLBACK_VIEW.loanRows,
    ),
    comparisonRows: orFallback(
      [bestSavingsRow(table), bestDepositRow(table), lowestLoanRow(table)].filter(
        (row): row is readonly string[] => row !== null,
      ),
      FALLBACK_VIEW.comparisonRows,
    ),
  };
}

/**
 * The rates page's data. Served through ISR: built once, revalidated hourly, and identical
 * whether the API answered or the static fallback stepped in.
 */
export async function getRatesView(): Promise<RatesView> {
  const table = await fetchRateTable();
  return table === null ? FALLBACK_VIEW : toView(table);
}
