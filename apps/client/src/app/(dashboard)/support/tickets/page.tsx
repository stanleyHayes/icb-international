import type { SupportTicket } from '@icb/contracts';
import { Card, CardHeader, EmptyState } from '@icb/ui';
import { MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { TicketList } from '@/features/support/ticket-list';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Messages' };

/** Every secure conversation, newest activity first. */
export default async function TicketsPage() {
  const tickets = await api<SupportTicket[]>('/support/tickets', { tags: ['support'] });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Messages</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Every conversation with us, in one place.
          </p>
        </div>
        <Link
          href="/support/tickets/new"
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          New message
        </Link>
      </header>

      <Card className="mt-8 overflow-hidden">
        <CardHeader title="Conversations" />
        {tickets.length > 0 ? (
          <TicketList tickets={tickets} />
        ) : (
          <EmptyState
            icon={<MessageSquare size={20} />}
            title="No conversations yet"
            description="Start a message and the whole thread stays here."
          />
        )}
      </Card>
    </>
  );
}
