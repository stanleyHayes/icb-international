'use client';

import type { TransferDetail } from '@icb/contracts';
import { Amount, Button, StatusBadge, formatDate } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

/**
 * Step 4 — the receipt, shown immediately after the API accepts the instruction. The full
 * posting timeline lives on the transfer's own page; this view confirms and routes onward.
 */
export function ReceiptStep({
  transfer,
  onReset,
}: Readonly<{ transfer: TransferDetail; onReset: () => void }>) {
  const scheduled = transfer.status === 'scheduled' || transfer.status === 'pending_approval';
  const heading = receiptHeading(transfer.status);

  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]">
        <CheckCircle2 size={24} />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{heading}</h2>
      <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
        {transfer.recipientName} · {transfer.recipientMasked}
      </p>
      <p className="mt-5">
        <Amount value={transfer.debitAmount} size="xl" />
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <StatusBadge status={transfer.status} />
        <span className="font-mono text-xs text-[var(--icb-text-subtle)]">{transfer.reference}</span>
      </div>
      {scheduled ? (
        <p className="mt-3 text-sm text-[var(--icb-text-muted)]">
          First execution {formatDate(transfer.executeAt, 'medium')}. You can cancel it any time
          before it runs.
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href={`/transfer/${transfer.id}`}
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          View receipt and timeline
        </Link>
        <Button variant="secondary" onClick={onReset}>
          Make another transfer
        </Button>
      </div>
    </div>
  );
}

function receiptHeading(status: TransferDetail['status']): string {
  if (status === 'pending_approval') {
    return 'Transfer pending approval';
  }
  if (status === 'scheduled') {
    return 'Transfer scheduled';
  }
  return 'Transfer sent';
}
