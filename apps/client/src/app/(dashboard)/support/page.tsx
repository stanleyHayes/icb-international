import type { Dispute, SupportTicket } from '@icb/contracts';
import { Card, CardBody, CardHeader, EmptyState } from '@icb/ui';
import { LifeBuoy, Lock, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ChannelCards } from '@/features/support/channel-cards';
import { DisputeList } from '@/features/support/dispute-list';
import { TicketList } from '@/features/support/ticket-list';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Support' };

const PREVIEW_COUNT = 3;

const IMMEDIATE = [
  { label: 'Review recent activity', href: '/transactions', detail: 'Every posting on every account, newest first' },
  { label: 'Check your balances', href: '/accounts', detail: 'Ledger, holds and available, side by side' },
  { label: 'Sign out everywhere', href: '/settings/security', detail: 'Ends every session on every device at once' },
] as const;

function openSummary(count: number): string | undefined {
  if (count === 0) return undefined;
  return `${count} conversation${count === 1 ? '' : 's'} in progress.`;
}

/**
 * Support.
 *
 * Leads with what is already in flight — open messages and disputes — then the actions a
 * worried customer needs in the first thirty seconds, then the channels to talk to someone.
 */
export default async function SupportPage() {
  const [tickets, disputes] = await Promise.all([
    api<SupportTicket[]>('/support/tickets', { tags: ['support'] }),
    api<{ items: Dispute[] }>('/disputes?limit=25', { tags: ['disputes'] }),
  ]);
  const open = tickets.filter((t) => t.status !== 'closed' && t.status !== 'resolved');

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Support</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Something wrong? Start here — the fastest fixes are one tap away.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        <CardHeader title="Your messages" description={openSummary(open.length)} />
        {tickets.length > 0 ? (
          <TicketList tickets={tickets.slice(0, PREVIEW_COUNT)} />
        ) : (
          <EmptyState
            icon={<MessageSquare size={20} />}
            title="No conversations yet"
            description="When you message us, the whole thread stays here — no lost emails, no reference numbers to quote."
          />
        )}
        <div className="flex gap-4 border-t border-[var(--icb-border)] px-5 py-3.5 text-sm font-medium">
          <Link href="/support/tickets/new" className="text-[var(--icb-primary)] hover:underline">
            Start a message
          </Link>
          {tickets.length > PREVIEW_COUNT ? (
            <Link href="/support/tickets" className="text-[var(--icb-primary)] hover:underline">
              View all {tickets.length}
            </Link>
          ) : null}
        </div>
      </Card>

      {disputes.items.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader
            title="Disputes"
            description="Card transactions you have challenged, and where each case stands."
          />
          <DisputeList disputes={disputes.items.slice(0, PREVIEW_COUNT)} />
          {disputes.items.length > PREVIEW_COUNT ? (
            <div className="border-t border-[var(--icb-border)] px-5 py-3.5 text-sm font-medium">
              <Link href="/support/disputes" className="text-[var(--icb-primary)] hover:underline">
                View all disputes
              </Link>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader
          title="Act now"
          description="If you think your account is at risk, do these first. You can talk to us afterwards."
        />
        <ul className="divide-y divide-[var(--icb-border)]">
          {IMMEDIATE.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-subtle)]"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{item.detail}</p>
                </div>
                <span aria-hidden="true" className="text-[var(--icb-text-subtle)]">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <section aria-labelledby="channels" className="mt-8">
        <h2 id="channels" className="font-display text-xl font-bold tracking-[-0.02em]">Talk to us</h2>
        <ChannelCards />
      </section>

      <Card className="mt-8">
        <CardBody className="pt-5">
          <div className="flex items-start gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-[var(--icb-accent)]" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">We will never ask for these</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                Your password, your PIN, a one-time code, or your full card number. Not by phone,
                not by email, not by message. Anyone who asks is not ICB, whatever the caller ID
                says. We will also never ask you to move money to a &ldquo;safe account&rdquo; —
                there is no such thing.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <p className="mt-8 flex items-center gap-2 text-sm text-[var(--icb-text-subtle)]">
        <LifeBuoy size={15} aria-hidden="true" />
        Complaints are acknowledged within three business days and resolved within eight weeks.
      </p>
    </>
  );
}
