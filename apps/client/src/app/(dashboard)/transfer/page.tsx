import type { AccountSummary, TransferSummary } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeftRight } from 'lucide-react';
import type { Metadata } from 'next';

import { TransferForm } from '@/features/transfer/transfer-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Transfer' };

export default async function TransferPage() {
  const [accountsResponse, transfersResponse] = await Promise.all([
    api<{ items: AccountSummary[] }>('/accounts', { tags: ['accounts'] }),
    api<{ items: TransferSummary[] }>('/transfers', { tags: ['transfers'] }),
  ]);

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Move money</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Between your own accounts, to another ICB customer, or to an external bank.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            title="New transfer"
            description="You will see the rail, fee and arrival time before anything moves."
          />
          <CardBody>
            <TransferForm accounts={accountsResponse.items} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent transfers" />
          {transfersResponse.items.length > 0 ? (
            <ul className="divide-y divide-[var(--icb-border)]">
              {transfersResponse.items.slice(0, 8).map((transfer) => (
                <li key={transfer.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transfer.recipientName}</p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                        {transfer.recipientMasked} · {transfer.reference}
                      </p>
                    </div>
                    <Amount value={transfer.debitAmount} direction="debit" size="sm" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge status={transfer.status} />
                    <span className="text-xs text-[var(--icb-text-subtle)]">
                      {formatDate(transfer.createdAt, 'medium')} · {transfer.rail.replace('_', '-')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ArrowLeftRight size={20} />}
              title="No transfers yet"
              description="Your first transfer will appear here with its full posting breakdown."
            />
          )}
        </Card>
      </div>
    </>
  );
}
