import type { Product } from '@icb/contracts';
import { Amount, BalanceAreaChart, Card, CardBody, CardHeader, StatusBadge } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { getAccount, getBalanceHistory, getHolds, listProducts } from '@/features/accounts/api';
import { HoldsTable } from '@/features/accounts/holds-table';
import { OpsPanels } from '@/features/accounts/ops-panels';
import { OverviewCards } from '@/features/accounts/overview-cards';

type Params = Promise<{ accountId: string }>;

export const metadata: Metadata = { title: 'Account' };

/**
 * The account operations console.
 *
 * One screen for everything staff do to an account: read its standing, change its lifecycle,
 * pricing and product, post manual adjustments for approval, and manage the holds against it.
 * Every mutation names a mandatory reason — the audit trail (N7) is how these stay operable.
 */
export default async function AccountDetailPage({ params }: Readonly<{ params: Params }>) {
  const { accountId } = await params;
  const account = await getAccount(accountId).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!account) {
    notFound();
  }

  const [history, holds, products] = await Promise.all([
    getBalanceHistory(accountId).catch(() => null),
    getHolds(accountId).catch(() => null),
    listProducts().catch(() => [] as Product[]),
  ]);

  return (
    <>
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Account search
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {account.nickname ?? account.productName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            {account.productName}
            <StatusBadge status={account.status} />
            <span className="capitalize">{account.kind.replaceAll('_', ' ')}</span>
            <Link href={`/customers/${account.customerId}`} className="hover:underline">
              View customer
            </Link>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
            Available balance
          </p>
          <p className="mt-1">
            <Amount value={account.balances.available} size="xl" />
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-6">
        <OverviewCards account={account} />
        <OpsPanels account={account} products={products} />

        <Card>
          <CardHeader title="Balance history" description="Daily closing balance" />
          <CardBody className="pt-0">
            {history ? (
              <BalanceAreaChart
                points={history.points.map((point) => ({
                  date: point.date,
                  minorUnits: point.closing.minorUnits,
                }))}
                currency={history.currency}
                label="Closing balance"
                emptyTitle="No history yet"
                emptyDescription="Closing balances appear after the first end-of-day run."
              />
            ) : (
              <p className="text-sm text-[var(--icb-text-subtle)]">
                Balance history is not available for this account.
              </p>
            )}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Holds" description="Reservations against the available balance" />
          {holds ? (
            <HoldsTable accountId={account.id} holds={holds} />
          ) : (
            <p className="px-5 pb-5 text-sm text-[var(--icb-text-subtle)]">
              Hold information is not available for this account.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
