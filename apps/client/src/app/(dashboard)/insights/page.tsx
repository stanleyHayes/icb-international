import type {
  AccountSummary,
  Cashflow,
  SpendByCategory,
  TransactionSummary,
} from '@icb/contracts';
import {
  Card,
  CardHeader,
  EmptyState,
  IncomeExpenseChart,
  SpendDonutChart,
} from '@icb/ui';
import { ChartPie, Repeat, Store } from 'lucide-react';
import type { Metadata } from 'next';

import { CategoryBreakdown } from '@/features/insights/category-breakdown';
import {
  detectRecurringCharges,
  periodLabel,
  projectCashflow,
  topMerchants,
} from '@/features/insights/derive';
import { MerchantLeaderboard } from '@/features/insights/merchant-leaderboard';
import { ProjectionSummary, RecurringCharges } from '@/features/insights/recurring-projection';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Insights' };

const DEFAULT_CURRENCY = 'USD';
const ANALYSIS_WINDOW_LIMIT = 100;

interface InsightsData {
  currency: string;
  currentMinorUnits: number;
  spend: SpendByCategory;
  cashflow: Cashflow;
  debits: TransactionSummary[];
}

/**
 * Loads the analytics endpoints and the raw debit feed the merchant and subscription
 * derivations run over. Everything is read in parallel; the currency of the first account
 * scopes every figure on the page.
 */
async function loadInsights(): Promise<InsightsData> {
  const { items: accounts } = await api<{ items: AccountSummary[] }>('/accounts', {
    tags: ['accounts'],
  });
  const currency = accounts[0]?.balances.ledger.currency ?? DEFAULT_CURRENCY;
  const currentMinorUnits = accounts
    .filter((account) => account.balances.ledger.currency === currency)
    .reduce((sum, account) => sum + account.balances.ledger.minorUnits, 0);

  const [spend, cashflow, debits] = await Promise.all([
    api<SpendByCategory>(`/transactions/analytics/spend-by-category?currency=${currency}`, {
      tags: ['insights'],
    }),
    api<Cashflow>(`/transactions/analytics/cashflow?currency=${currency}&granularity=month`, {
      tags: ['insights'],
    }),
    api<{ items: TransactionSummary[] }>(
      `/transactions?direction=debit&limit=${ANALYSIS_WINDOW_LIMIT}&includePending=false`,
      { tags: ['transactions'] },
    ),
  ]);

  return { currency, currentMinorUnits, spend, cashflow, debits: debits.items };
}

/**
 * Insights.
 *
 * Every figure on this page is derived from the ledger — the same postings the transaction
 * list shows — so nothing here can disagree with what the customer can check row by row.
 */
export default async function InsightsPage() {
  const { currency, currentMinorUnits, spend, cashflow, debits } = await loadInsights();

  const merchants = topMerchants(debits);
  const recurring = detectRecurringCharges(debits);
  const projection = projectCashflow(cashflow.points, currentMinorUnits);
  const hasSpend = spend.categories.length > 0;

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Insights</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Where your money goes, and where it is heading — read straight from your ledger.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Spend by category"
            description={`${formatPeriod(spend.period.from, spend.period.to)}, against the period before it.`}
          />
          {hasSpend ? (
            <div className="px-5 pb-5">
              <SpendDonutChart
                slices={spend.categories.map((row) => ({
                  category: row.category,
                  minorUnits: row.amount.minorUnits,
                }))}
                currency={currency}
                label="Spend by category"
              />
            </div>
          ) : (
            <EmptyState
              icon={<ChartPie size={20} />}
              title="Nothing spent yet"
              description="Once you start spending from this account, the breakdown appears here."
            />
          )}
        </Card>

        {hasSpend ? (
          <Card className="overflow-hidden">
            <CardHeader title="Categories" description="Share of spend, and the change on last period." />
            <CategoryBreakdown categories={spend.categories} />
          </Card>
        ) : null}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Month over month"
          description="Income against spending for each recent month."
        />
        <div className="px-5 pb-5">
          <IncomeExpenseChart
            periods={cashflow.points.map((point) => ({
              label: periodLabel(point.period),
              incomeMinorUnits: point.income.minorUnits,
              expenseMinorUnits: point.expense.minorUnits,
            }))}
            currency={currency}
            label="Monthly income and expenses"
          />
        </div>
      </Card>

      {projection ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader title="Cashflow projection" />
          <ProjectionSummary projection={projection} currency={currency} />
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Top merchants" description="Who took the most, over recent activity." />
          {merchants.length > 0 ? (
            <MerchantLeaderboard merchants={merchants} currency={currency} />
          ) : (
            <EmptyState
              icon={<Store size={20} />}
              title="No spending yet"
              description="Your most-used merchants will rank here."
            />
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Recurring charges"
            description="Same counterparty, similar amount, repeating — the shape of a subscription."
          />
          {recurring.length > 0 ? (
            <RecurringCharges charges={recurring} currency={currency} />
          ) : (
            <EmptyState
              icon={<Repeat size={20} />}
              title="No recurring charges found"
              description="Subscriptions and standing charges we detect in your activity will appear here."
            />
          )}
        </Card>
      </div>
    </>
  );
}

/** "2026-06-01" + "2026-06-30" → "1–30 June 2026", kept terse for a card description. */
function formatPeriod(from: string, to: string): string {
  const fromDate = new Date(`${from}T00:00:00Z`);
  const toDate = new Date(`${to}T00:00:00Z`);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${fromDate.getUTCDate()}–${toDate.getUTCDate()} ${month.format(toDate)}`;
}
