'use client';

import type { TransactionSummary } from '@icb/contracts';
import { TransactionList } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import { loadMoreTransactions } from './actions';
import type { Route } from 'next';

/**
 * The infinite ledger.
 *
 * The first page arrives server-rendered inside the props; everything after that is fetched
 * through a server action with the cursor the API returned, so the token never reaches the
 * browser. `@icb/ui`'s list owns the scroll sentinel — this wrapper owns the cursor.
 */
export function InfiniteTransactionList({
  initialTransactions,
  initialCursor,
  initialHasMore,
  queryString,
}: Readonly<{
  initialTransactions: TransactionSummary[];
  initialCursor: string | null;
  initialHasMore: boolean;
  queryString: string;
}>) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(() => {
    if (!cursor || pending) return;
    startTransition(async () => {
      try {
        const page = await loadMoreTransactions(queryString, cursor);
        setTransactions((current) => [...current, ...page.items]);
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(null);
      } catch {
        setError('We could not load more transactions. Please try again.');
      }
    });
  }, [cursor, pending, queryString]);

  return (
    <div>
      <TransactionList
        transactions={transactions}
        hasMore={hasMore}
        loading={pending}
        onLoadMore={loadMore}
        onSelect={(id) => router.push(`/transactions/${id}` as Route)}
        showRunningBalance
      />
      {error ? (
        <p role="alert" className="px-5 py-3 text-sm text-[var(--icb-danger-fg)]">
          {error}
        </p>
      ) : null}
      {hasMore ? (
        <div className="border-t border-[var(--icb-border)] px-5 py-3 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={pending}
            className="text-sm font-medium text-[var(--icb-primary)] underline-offset-4 hover:underline disabled:opacity-50"
          >
            {pending ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
