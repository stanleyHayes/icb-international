import { formatDate, formatTime } from '@icb/ui';
import { AlertTriangle } from 'lucide-react';

/**
 * SLA state for a ticket, rendered as the operator needs it: a breached deadline shouts,
 * everything else shows the due date quietly. The API computes `slaBreached` against the
 * bank's clock, so the console trusts it rather than re-deriving it.
 */
export function SlaBadge({
  breached,
  dueAt,
}: Readonly<{ breached: boolean; dueAt: string | null }>) {
  if (dueAt === null) {
    return <span className="text-[var(--icb-text-subtle)]">—</span>;
  }
  if (breached) {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-[var(--icb-danger-fg)]">
        <AlertTriangle size={13} aria-hidden="true" />
        Breached · {formatDate(dueAt, 'short')} {formatTime(dueAt)}
      </span>
    );
  }
  return (
    <span className="text-[var(--icb-text-subtle)]">
      {formatDate(dueAt, 'short')} {formatTime(dueAt)}
    </span>
  );
}
