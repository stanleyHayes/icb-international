import type { TransactionSummary } from '@icb/contracts';

import { cn } from '../lib/cn';
import { formatTime } from '../lib/format';
import { Amount } from './amount';
import { StatusBadge } from './status-badge';

export type TransactionRowProps = Readonly<{
  transaction: TransactionSummary;
  /** Presence turns the row into a button that reports the transaction id. */
  onSelect?: (id: string) => void;
  showRunningBalance?: boolean;
  className?: string;
}>;

function counterpartyName(transaction: TransactionSummary): string {
  return transaction.merchant?.name ?? transaction.counterparty?.name ?? transaction.description;
}

function RowBody({ transaction, showRunningBalance }: Readonly<Omit<TransactionRowProps, 'onSelect' | 'className'>>) {
  const secondary = `${transaction.category} · ${formatTime(transaction.bookedAt)}`;

  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{counterpartyName(transaction)}</span>
          {transaction.status !== 'posted' && transaction.status !== 'settled' ? (
            <StatusBadge status={transaction.status} />
          ) : null}
        </span>
        <span className="text-sm text-[var(--icb-text-subtle)] capitalize">{secondary}</span>
      </span>
      <span className="flex flex-col items-end">
        <Amount value={transaction.amount} direction={transaction.direction} size="sm" />
        {showRunningBalance && transaction.runningBalance ? (
          <Amount
            value={transaction.runningBalance}
            size="sm"
            className="font-normal text-[var(--icb-text-subtle)]"
          />
        ) : null}
      </span>
    </>
  );
}

/**
 * One row of a statement: who, when, how much, and what it left behind.
 *
 * The amount carries direction through `Amount`, so sign and colour agree. A non-final status
 * (pending, declined, …) is badged next to the name rather than hidden in a filter, because a
 * reader scanning their statement must not have to wonder why money has not moved.
 */
export function TransactionRow({
  transaction,
  onSelect,
  showRunningBalance = false,
  className,
}: TransactionRowProps) {
  const classes = cn(
    'flex w-full items-center gap-3 px-4 py-3 text-left',
    onSelect && 'cursor-pointer hover:bg-[var(--icb-bg-muted)]',
    className,
  );
  const body = <RowBody transaction={transaction} showRunningBalance={showRunningBalance} />;

  if (onSelect) {
    return (
      <button type="button" onClick={() => { onSelect(transaction.id); }} className={classes}>
        {body}
      </button>
    );
  }
  return <div className={classes}>{body}</div>;
}
