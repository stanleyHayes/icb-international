import type { Dispute } from '@icb/contracts';
import { Amount, StatusBadge, formatDate } from '@icb/ui';
import type { Route } from 'next';
import Link from 'next/link';

/** Human-readable dispute reason: 'not_received' → 'Not received'. */
function reasonLabel(reason: string): string {
  return reason.charAt(0).toUpperCase() + reason.slice(1).replaceAll('_', ' ');
}

/**
 * Dispute rows for the tracker. The stage badge carries the meaning — a customer checking a
 * dispute wants "where is it", not a wall of case data.
 */
export function DisputeList({ disputes }: Readonly<{ disputes: readonly Dispute[] }>) {
  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {disputes.map((dispute) => (
        <li key={dispute.id}>
          <Link
            href={`/support/disputes/${dispute.id}` as Route}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-subtle)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{reasonLabel(dispute.reason)}</p>
              <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                {dispute.reference} · opened {formatDate(dispute.createdAt, 'medium')}
              </p>
            </div>
            <Amount value={dispute.amount} size="sm" />
            <StatusBadge status={dispute.stage} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
