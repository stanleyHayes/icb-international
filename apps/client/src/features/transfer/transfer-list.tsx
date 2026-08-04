import type { TransferSummary } from '@icb/contracts';
import { Amount, StatusBadge, formatDate } from '@icb/ui';
import { ChevronRight, Repeat } from 'lucide-react';
import Link from 'next/link';

import { railInfo } from './transfer.constants';

/**
 * Rows of transfers, linked to their receipt pages. Shared by the hub's history and the
 * scheduled-transfers view.
 */
export function TransferList({ transfers }: Readonly<{ transfers: TransferSummary[] }>) {
  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {transfers.map((transfer) => (
        <li key={transfer.id}>
          <Link
            href={`/transfer/${transfer.id}`}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-muted)]"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                {transfer.recipientName}
                {transfer.recurring ? (
                  <Repeat size={13} aria-label="Repeating" className="shrink-0 text-[var(--icb-text-subtle)]" />
                ) : null}
              </p>
              <p className="mt-0.5 truncate font-mono text-xs text-[var(--icb-text-subtle)]">
                {transfer.recipientMasked} · {transfer.reference}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={transfer.status} />
                <span className="text-xs text-[var(--icb-text-subtle)]">
                  {transfer.status === 'scheduled'
                    ? `Runs ${formatDate(transfer.executeAt, 'medium')}`
                    : formatDate(transfer.createdAt, 'medium')}{' '}
                  · {railInfo(transfer.rail).title}
                </span>
              </div>
            </div>
            <Amount value={transfer.debitAmount} direction="debit" size="sm" />
            <ChevronRight size={16} className="shrink-0 text-[var(--icb-text-subtle)]" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
