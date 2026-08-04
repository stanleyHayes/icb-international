import type { AccountSummary, CursorPage, TransactionSummary } from '@icb/contracts';
import { Card } from '@icb/ui';
import type { Metadata } from 'next';

import { ExportDialog } from '@/features/transactions/export-dialog';
import { InfiniteTransactionList } from '@/features/transactions/infinite-transaction-list';
import { TRANSACTION_PAGE_SIZE, buildTransactionsQuery, type RawSearchParams } from '@/features/transactions/query';
import { TransactionFilters } from '@/features/transactions/transaction-filters';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Transactions' };

/**
 * The whole ledger: searchable, filterable, endless.
 *
 * Filters live in the URL, so a filtered view can be shared or bookmarked and the back button
 * behaves the way a customer expects. The first page is server-rendered with the filters
 * applied; the infinite list picks up from its cursor.
 */
export default async function TransactionsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<RawSearchParams> }>) {
  const raw = await searchParams;
  const queryString = buildTransactionsQuery(raw, TRANSACTION_PAGE_SIZE);

  const [page, accountsResponse] = await Promise.all([
    api<CursorPage<TransactionSummary>>(`/transactions?${queryString}`, { tags: ['transactions'] }),
    api<{ items: AccountSummary[] }>('/accounts', { tags: ['accounts'] }),
  ]);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Transactions</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Every posting across your accounts, newest first.
          </p>
        </div>
        <ExportDialog accounts={accountsResponse.items} />
      </header>

      <div className="mt-6">
        <TransactionFilters accounts={accountsResponse.items} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <InfiniteTransactionList
          key={queryString}
          initialTransactions={page.items}
          initialCursor={page.nextCursor}
          initialHasMore={page.hasMore}
          queryString={queryString}
        />
      </Card>
    </>
  );
}
