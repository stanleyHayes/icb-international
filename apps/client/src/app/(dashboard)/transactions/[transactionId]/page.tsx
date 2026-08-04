import type { TransactionDetail } from '@icb/contracts';
import { Amount, Card, CardHeader, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft, FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { TransactionSidebar } from '@/features/transactions/transaction-sidebar';
import { api } from '@/lib/api';

type Params = Promise<{ transactionId: string }>;

export const metadata: Metadata = { title: 'Transaction' };

/**
 * One transaction, including both sides of it.
 *
 * The posting table is the point: a customer can see exactly what was debited, what was
 * credited, and that the two balance. Nothing is netted off and nothing is hidden behind a
 * summary line.
 */
export default async function TransactionDetailPage({ params }: Readonly<{ params: Params }>) {
  const { transactionId } = await params;
  const transaction = await api<TransactionDetail>(`/transactions/${transactionId}`, {
    tags: ['transactions'],
  });

  const totalDebits = transaction.postings
    .filter((posting) => posting.direction === 'debit')
    .reduce((total, posting) => total + posting.amount.minorUnits, 0);
  const totalCredits = transaction.postings
    .filter((posting) => posting.direction === 'credit')
    .reduce((total, posting) => total + posting.amount.minorUnits, 0);

  return (
    <>
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All transactions
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={transaction.status} />
            <span className="capitalize">{transaction.type.replaceAll('_', ' ')}</span>
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em]">
            {transaction.description}
          </h1>
          <p className="mt-4">
            <Amount value={transaction.amount} direction={transaction.direction} size="display" />
          </p>
          <p className="mt-2 text-sm text-[var(--icb-text-muted)]">
            {formatDate(transaction.bookedAt, 'long')} at {formatTime(transaction.bookedAt)}
          </p>
        </div>
        <a
          href={`/transactions/${transaction.id}/receipt`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
        >
          <FileText size={16} />
          Receipt
        </a>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <PostingsTable transaction={transaction} totalDebits={totalDebits} totalCredits={totalCredits} />
        <TransactionSidebar transaction={transaction} />
      </div>
    </>
  );
}

/** Both sides of the transaction, and proof that they balance. */
function PostingsTable({
  transaction,
  totalDebits,
  totalCredits,
}: Readonly<{ transaction: TransactionDetail; totalDebits: number; totalCredits: number }>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Postings" description="Both sides of this transaction, as written to the ledger." />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <caption className="sr-only">Ledger postings for this transaction</caption>
          <thead>
            <tr className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2 font-medium">
                Account
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Debit
              </th>
              <th scope="col" className="px-5 py-2 text-right font-medium">
                Credit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)] font-mono">
            {transaction.postings.map((posting) => (
              <tr key={posting.id}>
                <td className="px-5 py-2.5 text-xs">{posting.accountLabel}</td>
                <td className="tabular px-3 py-2.5 text-right">
                  {posting.direction === 'debit' ? (
                    <Amount value={posting.amount} size="sm" />
                  ) : (
                    <span className="text-[var(--icb-text-subtle)]">—</span>
                  )}
                </td>
                <td className="tabular px-5 py-2.5 text-right">
                  {posting.direction === 'credit' ? (
                    <Amount value={posting.amount} size="sm" />
                  ) : (
                    <span className="text-[var(--icb-text-subtle)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--icb-border-strong)] font-semibold">
              <td className="px-5 py-3">
                {totalDebits === totalCredits ? 'Balanced' : 'OUT OF BALANCE'}
              </td>
              <td className="tabular px-3 py-3 text-right">
                <Amount value={{ ...transaction.amount, minorUnits: totalDebits }} size="sm" />
              </td>
              <td className="tabular px-5 py-3 text-right">
                <Amount value={{ ...transaction.amount, minorUnits: totalCredits }} size="sm" />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
