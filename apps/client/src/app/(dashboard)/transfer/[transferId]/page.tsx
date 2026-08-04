import type { TransferDetail, TransferStatus } from '@icb/contracts';
import {
  Amount,
  Card,
  CardBody,
  CardHeader,
  StatusBadge,
  Timeline,
  type TimelineItem,
  type TimelineTone,
} from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  TransferCancelCard,
  TransferDetailsCard,
} from '@/features/transfer/transfer-details-card';
import { railInfo } from '@/features/transfer/transfer.constants';
import { api } from '@/lib/api';

type Params = Promise<{ transferId: string }>;

export const metadata: Metadata = { title: 'Transfer receipt' };

function toneFor(status: TransferStatus): TimelineTone {
  if (status === 'completed') {
    return 'success';
  }
  if (status === 'failed' || status === 'returned' || status === 'cancelled') {
    return 'danger';
  }
  return 'default';
}

function timelineItems(transfer: TransferDetail): TimelineItem[] {
  return transfer.timeline.map((event, index) => ({
    id: `${event.at}-${index}`,
    title: event.label,
    ...(event.detail ? { description: event.detail } : {}),
    timestamp: event.at,
    tone: toneFor(event.status),
  }));
}

/**
 * The receipt: what was instructed, what it cost, and every status the instruction has passed
 * through, from quote to settlement. Failed transfers show the failure reason, not a shrug.
 */
export default async function TransferDetailPage({ params }: Readonly<{ params: Params }>) {
  const { transferId } = await params;
  const transfer = await api<TransferDetail>(`/transfers/${transferId}`, {
    tags: ['transfers'],
  });
  const rail = railInfo(transfer.rail);

  return (
    <>
      <Link
        href="/transfer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Move money
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {transfer.recipientName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            {transfer.recipientMasked} · {rail.title}
            <StatusBadge status={transfer.status} />
          </p>
        </div>
        <div className="text-right">
          <Amount value={transfer.debitAmount} size="xl" direction="debit" />
          <p className="mt-1 font-mono text-xs text-[var(--icb-text-subtle)]">
            {transfer.reference}
          </p>
        </div>
      </header>

      {transfer.failureReason ? (
        <p
          role="alert"
          className="mt-6 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          {transfer.failureReason}
          {transfer.failureCode ? ` (${transfer.failureCode})` : ''}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Status history" />
          <CardBody>
            <Timeline items={timelineItems(transfer)} />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <TransferDetailsCard transfer={transfer} />
          <TransferCancelCard transfer={transfer} />
        </div>
      </div>
    </>
  );
}
