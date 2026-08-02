import type { TransactionSummary } from '@icb/contracts';
import { Amount, StatusBadge, formatRelativeDay } from '@icb/ui';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

/**
 * A list of transactions, grouped by day.
 *
 * Grouping is what makes a statement readable: a flat list of 200 rows forces the reader to
 * compare dates line by line, while day headings let them find "last Tuesday" at a glance.
 */
export function TransactionList({
  transactions,
}: Readonly<{ transactions: TransactionSummary[] }>) {
  const groups = groupByDay(transactions);

  return (
    <div>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="sticky top-0 z-10 bg-[var(--icb-bg-subtle)]/95 px-5 py-1.5 text-xs font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase backdrop-blur-sm">
            {group.label}
          </h3>
          <ul className="divide-y divide-[var(--icb-border)]">
            {group.items.map((transaction) => (
              <li
                key={transaction.id + transaction.accountId}
                className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-[var(--icb-bg-subtle)]"
              >
                <span
                  aria-hidden="true"
                  className={
                    transaction.direction === 'credit'
                      ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]'
                      : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]'
                  }
                >
                  {transaction.direction === 'credit' ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{transaction.description}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--icb-text-subtle)] capitalize">
                    {transaction.category.replaceAll('_', ' ')}
                    {transaction.pending ? <StatusBadge status="pending" /> : null}
                  </p>
                </div>

                <Amount
                  value={transaction.amount}
                  direction={transaction.direction}
                  size="sm"
                  className="shrink-0"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

interface DayGroup {
  key: string;
  label: string;
  items: TransactionSummary[];
}

function groupByDay(transactions: TransactionSummary[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();

  for (const transaction of transactions) {
    const key = transaction.valueDate;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(transaction);
      continue;
    }
    groups.set(key, {
      key,
      label: formatRelativeDay(transaction.valueDate),
      items: [transaction],
    });
  }

  return [...groups.values()];
}
