import type { TransactionDetail } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, formatDate } from '@icb/ui';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { AnnotationEditor } from './annotation-editor';

/**
 * The right rail of the transaction page: facts, the customer's own annotations, and the way
 * to challenge the transaction.
 */
export function TransactionSidebar({ transaction }: Readonly<{ transaction: TransactionDetail }>) {
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
                transaction.settledAt ? formatDate(transaction.settledAt, 'medium') : 'Not yet settled'
              }
            />
            {transaction.reversedById ? <Row label="Reversed by" value={transaction.reversedById} mono /> : null}
            {transaction.reversalOfId ? <Row label="Reverses" value={transaction.reversalOfId} mono /> : null}
          </dl>
          {transaction.fees.length > 0 ? (
            <dl className="mt-3 space-y-3 border-t border-[var(--icb-border)] pt-3 text-sm">
              {transaction.fees.map((fee) => (
                <div
                  key={fee.code}
                  className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0"
                >
                  <dt className="shrink-0 text-[var(--icb-text-subtle)]">{fee.label}</dt>
                  <dd className="text-right">
                    <Amount value={fee.amount} size="sm" />
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notes & tags" description="Private to you — never sent to the payee." />
        <CardBody className="space-y-3 pt-0">
          {transaction.note ? (
            <p className="text-sm whitespace-pre-wrap text-[var(--icb-text)]">{transaction.note}</p>
          ) : (
            <p className="text-sm text-[var(--icb-text-subtle)]">No note yet.</p>
          )}
          {transaction.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {transaction.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-[var(--icb-bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--icb-text-muted)]"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
          <AnnotationEditor transaction={transaction} />
        </CardBody>
      </Card>

      {transaction.status !== 'reversed' ? (
        <Card>
          <CardBody className="pt-5">
            <div className="flex items-start gap-3">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)]" aria-hidden="true" />
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

function Row({ label, value, mono = false }: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className={mono ? 'text-right font-mono text-xs break-all' : 'text-right capitalize'}>
        {value}
      </dd>
    </div>
  );
}
