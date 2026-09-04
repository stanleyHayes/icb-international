'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { TransactionSummary } from '@icb/contracts';

import { cn } from '../lib/cn';
import { formatRelativeDay } from '../lib/format';
import { EmptyState } from '../feedback/empty-state';
import { SkeletonTransactionList } from './skeletons';
import { TransactionRow } from './transaction-row';

export type TransactionListProps = Readonly<{
  transactions: TransactionSummary[];
  /** More pages exist on the server; the sentinel asks for them as it scrolls into view. */
  hasMore: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  onSelect?: (id: string) => void;
  showRunningBalance?: boolean;
  emptyState?: ReactNode;
  className?: string;
}>;

export interface TransactionDayGroup {
  /** YYYY-MM-DD — stable React key and sort key. */
  day: string;
  label: string;
  items: TransactionSummary[];
}

/** Group a date-ordered statement into labelled days. Pure, so the grouping is unit-testable. */
/**
 * The identity of one row.
 *
 * A summary is one *leg* of a transaction, so the id alone is not unique: a transfer between two
 * of the customer's own accounts puts both legs in this list under the same id. The account is
 * what separates them.
 */
export function transactionRowKey(transaction: TransactionSummary): string {
  return `${transaction.id}:${transaction.accountId}`;
}

export function groupTransactionsByDay(transactions: TransactionSummary[]): TransactionDayGroup[] {
  const groups = new Map<string, TransactionSummary[]>();
  for (const transaction of transactions) {
    const day = transaction.bookedAt.slice(0, 10);
    const bucket = groups.get(day);
    if (bucket) {
      bucket.push(transaction);
    } else {
      groups.set(day, [transaction]);
    }
  }
  return [...groups.entries()].map(([day, items]) => ({
    day,
    label: formatRelativeDay(items[0]?.bookedAt ?? day),
    items,
  }));
}

/**
 * An infinite statement: day-grouped rows with an IntersectionObserver sentinel that asks for
 * the next page as it approaches the viewport.
 *
 * Grouping by day is how people actually read a statement — "what did I spend on Friday?" — so
 * the day label repeats as a sticky-ish heading rather than a column on every row.
 */
export function TransactionList({
  transactions,
  hasMore,
  loading = false,
  onLoadMore,
  onSelect,
  showRunningBalance = false,
  emptyState,
  className,
}: TransactionListProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || onLoadMore === undefined) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMore();
      }
    });
    observer.observe(sentinel);
    return () => { observer.disconnect(); };
  }, [hasMore, loading, onLoadMore]);

  if (transactions.length === 0 && !loading) {
    return (
      <>
        {emptyState ?? (
          <EmptyState
            title="No transactions yet"
            description="Activity on this account will appear here."
          />
        )}
      </>
    );
  }

  const groups = groupTransactionsByDay(transactions);

  return (
    <div className={cn('flex flex-col', className)}>
      {groups.map((group) => (
        <section key={group.day} aria-label={group.label}>
          <h3 className="px-4 pt-4 pb-1 text-xs font-semibold tracking-[0.06em] text-[var(--icb-text-subtle)] uppercase">
            {group.label}
          </h3>
          <div className="divide-y divide-[var(--icb-border)]">
            {group.items.map((transaction) => (
              <TransactionRow
                key={transactionRowKey(transaction)}
                transaction={transaction}
                showRunningBalance={showRunningBalance}
                {...(onSelect ? { onSelect } : {})}
              />
            ))}
          </div>
        </section>
      ))}
      {loading ? <SkeletonTransactionList rows={3} /> : null}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
    </div>
  );
}
