import type { CursorPage, TransactionSummary } from '@icb/contracts';
import { Card, EmptyState } from '@icb/ui';
import { Receipt } from 'lucide-react';
import type { Metadata } from 'next';

import { TransactionList } from '@/components/transaction-list';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Transactions' };

export default async function TransactionsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ q?: string; direction?: string }>;
}>) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: '50' });
  if (params.q) query.set('q', params.q);
  if (params.direction === 'debit' || params.direction === 'credit') {
    query.set('direction', params.direction);
  }

  const page = await api<CursorPage<TransactionSummary>>(`/transactions?${query.toString()}`, {
    tags: ['transactions'],
  });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Transactions</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Every posting across your accounts, newest first.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        {page.items.length > 0 ? (
          <TransactionList transactions={page.items} />
        ) : (
          <EmptyState
            icon={<Receipt size={20} />}
            title="No transactions found"
            description="Nothing matches this view yet."
          />
        )}
      </Card>

      {page.hasMore ? (
        <p className="mt-4 text-center text-sm text-[var(--icb-text-subtle)]">
          Showing the most recent {page.items.length} transactions.
        </p>
      ) : null}
    </>
  );
}
