import type { AccountSummary, CursorPage, TransactionSummary } from '@icb/contracts';
import { Balance, Button, Card, CardHeader, EmptyState, maskIdentifier } from '@icb/ui';
import { ArrowLeftRight, Plus, Receipt, Wallet } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { CurrencyTotals, type CurrencyTotal } from '@/components/currency-totals';
import { PrimaryAccountCard } from '@/components/primary-account-card';
import { TransactionList } from '@/components/transaction-list';
import { UpcomingPaymentsCard } from '@/features/accounts/upcoming-payments-card';
import { SpendSummaryCard } from '@/features/transactions/spend-summary-card';
import { api } from '@/lib/api';
import { readSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Overview' };

/**
 * The overview.
 *
 * Data is fetched in parallel on the server. Nothing here is a client component except the
 * interactive bits, so the first paint already contains the customer's real balances rather than
 * a spinner that resolves into them.
 */
export default async function OverviewPage() {
  const session = await readSession();
  const [accountsResponse, transactions] = await Promise.all([
    api<{ items: AccountSummary[] }>('/accounts', { tags: ['accounts'] }),
    api<CursorPage<TransactionSummary>>('/transactions?limit=6', { tags: ['transactions'] }),
  ]);

  const accounts = accountsResponse.items;
  const primary = accounts.find((account) => account.primary) ?? accounts[0];
  const totals = totalByCurrency(accounts);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--icb-text-muted)]">{greeting()}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-[-0.02em]">
            {session?.user.firstName}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/transfer">
            <Button leadingIcon={<ArrowLeftRight size={16} />}>Move money</Button>
          </Link>
          <Link href="/bills">
            <Button variant="secondary" leadingIcon={<Wallet size={16} />}>
              Pay a bill
            </Button>
          </Link>
          <Link href="/accounts">
            <Button variant="secondary" leadingIcon={<Plus size={16} />}>
              New account
            </Button>
          </Link>
        </div>
      </header>

      <CurrencyTotals totals={totals} />

      {primary ? <PrimaryAccountCard account={primary} /> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link
                href="/transactions"
                className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
              >
                See all
              </Link>
            }
          />
          {transactions.items.length > 0 ? (
            <TransactionList transactions={transactions.items} />
          ) : (
            <EmptyState
              icon={<Receipt size={20} />}
              title="No transactions yet"
              description="Activity on your accounts will appear here."
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Your accounts" description={`${accounts.length} open`} />
          <ul className="divide-y divide-[var(--icb-border)]">
            {accounts.map((account) => (
              <li key={account.id}>
                <Link
                  href={`/accounts/${account.id}` as Route}
                  className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-subtle)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {account.nickname ?? account.productName}
                    </p>
                    <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                      {maskIdentifier(account.identifiers.number)}
                    </p>
                  </div>
                  <Balance
                    ledger={account.balances.ledger}
                    available={account.balances.available}
                    size="md"
                    className="shrink-0 items-end text-right"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <UpcomingPaymentsCard />
        {primary ? <SpendSummaryCard currency={primary.currency} /> : null}
      </div>
    </>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function totalByCurrency(accounts: AccountSummary[]): CurrencyTotal[] {
  const totals = new Map<string, { minorUnits: number; accounts: number }>();

  for (const account of accounts) {
    const existing = totals.get(account.currency) ?? { minorUnits: 0, accounts: 0 };
    totals.set(account.currency, {
      minorUnits: existing.minorUnits + account.balances.ledger.minorUnits,
      accounts: existing.accounts + 1,
    });
  }

  return [...totals.entries()].map(([currency, value]) => ({ currency, ...value }));
}
