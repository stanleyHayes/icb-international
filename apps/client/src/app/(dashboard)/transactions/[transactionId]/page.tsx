import type { TransactionDetail } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

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

      <header className="mt-4">
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
          <CardHeader
            title="Postings"
            description="Both sides of this transaction, as written to the ledger."
          />
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
                    <Amount
                      value={{ ...transaction.amount, minorUnits: totalDebits }}
                      size="sm"
                    />
                  </td>
                  <td className="tabular px-5 py-3 text-right">
                    <Amount
                      value={{ ...transaction.amount, minorUnits: totalCredits }}
                      size="sm"
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
  );
}

function TransactionSidebar({ transaction }: Readonly<{ transaction: TransactionDetail }>) {
  return (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <Row label="Reference" value={transaction.reference} mono />
                <Row label="Category" value={transaction.category.replaceAll('_', ' ')} />
                <Row label="Value date" value={formatDate(transaction.valueDate, 'medium')} />
                <Row
                  label="Settled"
                  value={
                    transaction.settledAt
                      ? formatDate(transaction.settledAt, 'medium')
                      : 'Not yet settled'
                  }
                />
                {transaction.reversedById ? (
                  <Row label="Reversed by" value={transaction.reversedById} mono />
                ) : null}
                {transaction.reversalOfId ? (
                  <Row label="Reverses" value={transaction.reversalOfId} mono />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {transaction.status !== 'reversed' ? (
            <Card>
              <CardBody className="pt-5">
                <div className="flex items-start gap-3">
                  <ShieldAlert
                    size={18}
                    className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium">Not recognise this?</p>
                    <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
                      Raise a dispute and we will assess provisional credit within 48 hours.
                    </p>
                    <Link
                      href={`/support?dispute=${transaction.id}`}
                      className="mt-3 inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
                    >
                      Dispute this transaction
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className={mono ? 'text-right font-mono text-xs break-all' : 'text-right capitalize'}>
        {value}
      </dd>
    </div>
  );
}
