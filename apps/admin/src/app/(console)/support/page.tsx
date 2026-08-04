import { Card, EmptyState, StatusBadge } from '@icb/ui';
import { Inbox, ListOrdered, PhoneCall } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { SlaBadge } from '@/features/support/sla-badge';
import type { StaffTicketView } from '@/features/support/types';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Support inbox' };

type Params = { status?: string; assignedTo?: string; slaBreached?: string };
type SearchParams = Promise<Params>;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'awaiting_customer', label: 'Awaiting customer' },
  { value: 'awaiting_agent', label: 'Awaiting agent' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const;

const PRIORITY_CLASS: Readonly<Record<string, string>> = {
  urgent: 'text-[var(--icb-danger-fg)] font-semibold',
  high: 'text-[var(--icb-warning-fg)] font-medium',
  normal: 'text-[var(--icb-text)]',
  low: 'text-[var(--icb-text-subtle)]',
};

/**
 * The ticket queue.
 *
 * The API returns the inbox most-overdue first, and the filters mirror that priority: an
 * operator should be able to get from "what is on fire" to the ticket in one click.
 */
export default async function SupportInboxPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: '100' });
  if (params.status) query.set('status', params.status);
  if (params.assignedTo) query.set('assignedTo', params.assignedTo);
  if (params.slaBreached === 'true') query.set('slaBreached', 'true');

  const [tickets, all] = await Promise.all([
    api<StaffTicketView[]>(`/support/staff/inbox?${query.toString()}`),
    api<StaffTicketView[]>('/support/staff/inbox?limit=100'),
  ]);

  const breached = all.filter((ticket) => ticket.slaBreached).length;
  const unassigned = all.filter((ticket) => ticket.assignedTo === null).length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Support inbox</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {all.length} ticket{all.length === 1 ? '' : 's'} in view
            {breached > 0 ? ` · ${breached} past SLA` : ''}
            {unassigned > 0 ? ` · ${unassigned} unassigned` : ''}
          </p>
        </div>
        <nav aria-label="Support tools" className="flex gap-2">
          <Link href="/support/callbacks" className={toolClass()}>
            <PhoneCall size={15} aria-hidden="true" />
            Callbacks
          </Link>
          <Link href="/support/macros" className={toolClass()}>
            <ListOrdered size={15} aria-hidden="true" />
            Macros
          </Link>
        </nav>
      </header>

      <StatusFilters params={params} />
      <TicketTable tickets={tickets} />
    </>
  );
}

function StatusFilters({ params }: Readonly<{ params: Params }>) {
  const toggles = [
    { key: 'assignedTo', value: 'unassigned', label: 'Unassigned' },
    { key: 'assignedTo', value: 'me', label: 'Assigned to me' },
    { key: 'slaBreached', value: 'true', label: 'SLA breached' },
  ] as const;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {STATUS_FILTERS.map((filter) => (
        <Link
          key={filter.value}
          href={buildHref(params, 'status', filter.value)}
          className={filterClass((params.status ?? '') === filter.value)}
          aria-current={(params.status ?? '') === filter.value ? 'page' : undefined}
        >
          {filter.label}
        </Link>
      ))}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--icb-border)]" />
      {toggles.map((toggle) => {
        const active = params[toggle.key] === toggle.value;
        return (
          <Link
            key={toggle.label}
            href={buildHref(params, toggle.key, active ? '' : toggle.value)}
            className={filterClass(active)}
            aria-current={active ? 'page' : undefined}
          >
            {toggle.label}
          </Link>
        );
      })}
    </div>
  );
}

function TicketTable({ tickets }: Readonly<{ tickets: StaffTicketView[] }>) {
  if (tickets.length === 0) {
    return (
      <Card className="mt-4 overflow-hidden">
        <EmptyState
          icon={<Inbox size={20} />}
          title="No tickets match"
          description="Nothing in the queue matches these filters."
        />
      </Card>
    );
  }

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Support tickets, most overdue first</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Ticket
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Customer
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Priority
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Assignee
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                SLA
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TicketRow({ ticket }: Readonly<{ ticket: StaffTicketView }>) {
  return (
    <tr className="hover:bg-[var(--icb-bg-subtle)]">
      <td className="max-w-[320px] px-5 py-3">
        <Link
          href={`/support/${ticket.id}`}
          className="block truncate font-medium hover:underline"
        >
          {ticket.subject}
        </Link>
        <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
          {ticket.reference} · {ticket.category.replaceAll('_', ' ')}
        </p>
      </td>
      <td className="px-3 py-3 text-xs">{ticket.customerName}</td>
      <td className={`px-3 py-3 text-xs capitalize ${PRIORITY_CLASS[ticket.priority] ?? ''}`}>
        {ticket.priority}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={ticket.status} />
      </td>
      <td className="px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
        {ticket.assignedToName ?? 'Unassigned'}
      </td>
      <td className="px-5 py-3 text-right text-xs">
        <SlaBadge breached={ticket.slaBreached} dueAt={ticket.slaDueAt} />
      </td>
    </tr>
  );
}

function buildHref(current: Params, key: keyof Params, value: string): Route {
  const merged = { ...current, [key]: value };
  const query = new URLSearchParams();
  if (merged.status) query.set('status', merged.status);
  if (merged.assignedTo) query.set('assignedTo', merged.assignedTo);
  if (merged.slaBreached) query.set('slaBreached', merged.slaBreached);
  const suffix = query.toString();
  return suffix ? `/support?${suffix}` : '/support';
}

function filterClass(active: boolean): string {
  return active
    ? 'inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white'
    : 'inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}

function toolClass(): string {
  return 'inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}
