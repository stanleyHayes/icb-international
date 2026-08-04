import type { SupportTicket } from '@icb/contracts';
import { StatusBadge, formatRelativeDay } from '@icb/ui';
import type { Route } from 'next';
import Link from 'next/link';

/**
 * Ticket rows, newest activity first. Used at full length on the tickets page and trimmed on
 * the support hub — same rows in both places, so a ticket never reads differently depending on
 * where the customer found it.
 */
export function TicketList({ tickets }: Readonly<{ tickets: readonly SupportTicket[] }>) {
  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/support/tickets/${ticket.id}` as Route}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-subtle)]"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{ticket.subject}</p>
              <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                {ticket.reference} · {ticket.messageCount} message
                {ticket.messageCount === 1 ? '' : 's'} · {formatRelativeDay(ticket.lastMessageAt)}
              </p>
            </div>
            <StatusBadge status={ticket.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
