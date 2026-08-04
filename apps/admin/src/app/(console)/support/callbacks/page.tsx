import { Card, EmptyState, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft, PhoneCall } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CallbackActions } from '@/features/support/callback-row-actions';
import type { CallbackView } from '@/features/support/types';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Callbacks' };

type SearchParams = Promise<{ status?: string }>;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

/**
 * The callback list.
 *
 * Customers ask to be called rather than wait in a thread; the pending list is the team's
 * promise log, and it defaults to pending so nothing requested goes stale out of sight.
 */
export default async function CallbacksPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const status = params.status ?? 'pending';
  const query = status ? `?status=${status}` : '';
  const callbacks = await api<CallbackView[]>(`/support/staff/callbacks${query}`);

  return (
    <>
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Support inbox
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Callbacks</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {callbacks.length} {status || 'total'} request{callbacks.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={
                filter.value ? `/support/callbacks?status=${filter.value}` : '/support/callbacks'
              }
              className={filterClass(status === filter.value)}
              aria-current={status === filter.value ? 'page' : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </header>

      <CallbackTable callbacks={callbacks} status={status} />
    </>
  );
}

function CallbackTable({
  callbacks,
  status,
}: Readonly<{ callbacks: CallbackView[]; status: string }>) {
  if (callbacks.length === 0) {
    return (
      <Card className="mt-6 overflow-hidden">
        <EmptyState
          icon={<PhoneCall size={20} />}
          title="No callbacks"
          description={
            status === 'pending' ? 'Nobody is waiting for a call.' : 'No requests match this filter.'
          }
        />
      </Card>
    );
  }

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Customer callback requests</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">
                Customer
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Reason
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Window
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Requested
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Status
              </th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {callbacks.map((callback) => (
              <CallbackRow key={callback.id} callback={callback} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function CallbackRow({ callback }: Readonly<{ callback: CallbackView }>) {
  return (
    <tr className="hover:bg-[var(--icb-bg-subtle)]">
      <td className="px-5 py-3">
        <p className="font-medium">{callback.customerName}</p>
        <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
          {callback.reference} · {callback.phone}
        </p>
      </td>
      <td className="max-w-[280px] px-3 py-3 text-xs">
        <span className="line-clamp-2">{callback.reason}</span>
        {callback.ticketId ? (
          <Link
            href={`/support/${callback.ticketId}`}
            className="mt-1 inline-block text-[var(--icb-primary)] hover:underline"
          >
            Linked ticket
          </Link>
        ) : null}
      </td>
      <td className="px-3 py-3 text-xs capitalize">{callback.preferredWindow}</td>
      <td className="px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
        {formatDate(callback.requestedAt, 'short')} {formatTime(callback.requestedAt)}
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={callback.status} />
      </td>
      <td className="px-5 py-3">
        {callback.status === 'pending' ? (
          <CallbackActions callback={callback} />
        ) : (
          <p className="text-right text-xs text-[var(--icb-text-subtle)]">
            {callback.handledBy ?? ''}
          </p>
        )}
      </td>
    </tr>
  );
}

function filterClass(active: boolean): string {
  return active
    ? 'inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white'
    : 'inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}
