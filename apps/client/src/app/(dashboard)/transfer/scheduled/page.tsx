import type { CursorPage, StandingOrder, TransferSummary } from '@icb/contracts';
import {
  Amount,
  Card,
  CardHeader,
  EmptyState,
  StatusBadge,
  formatDate,
} from '@icb/ui';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CancelStandingOrderButton } from '@/features/transfer/cancel-standing-order-button';
import { describeDestination } from '@/features/transfer/destination';
import { TransferList } from '@/features/transfer/transfer-list';
import { frequencyLabel } from '@/features/transfer/transfer.constants';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Scheduled payments' };

/**
 * Future money in one place: one-off scheduled transfers and live standing orders, each
 * cancellable until it runs.
 */
export default async function ScheduledPaymentsPage() {
  const [transfersPage, standingOrders] = await Promise.all([
    api<CursorPage<TransferSummary>>('/transfers?limit=50', { tags: ['transfers'] }),
    api<StandingOrder[]>('/standing-orders', { tags: ['standing-orders'] }),
  ]);

  const scheduled = transfersPage.items.filter(
    (transfer) => transfer.status === 'scheduled' || transfer.status === 'pending_approval',
  );
  const activeOrders = standingOrders.filter((order) => order.status !== 'cancelled');

  return (
    <>
      <Link
        href="/transfer"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Move money
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
          Scheduled payments
        </h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Future-dated transfers and standing orders. Cancel any of them before they run.
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <Card className="overflow-hidden">
          <CardHeader
            title="Future-dated transfers"
            description="Single transfers waiting for their execution date."
          />
          {scheduled.length > 0 ? (
            <TransferList transfers={scheduled} />
          ) : (
            <EmptyState
              icon={<CalendarClock size={20} />}
              title="Nothing scheduled"
              description="Choose “On a date” when setting up a transfer and it will wait here until it runs."
            />
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Standing orders"
            description="Repeating payments running on a schedule."
          />
          {activeOrders.length > 0 ? (
            <ul className="divide-y divide-[var(--icb-border)]">
              {activeOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{order.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--icb-text-subtle)]">
                      {describeDestination(order.destination)} ·{' '}
                      {order.schedule.rrule ? frequencyLabel(order.schedule.rrule) : 'Repeating'} ·{' '}
                      {order.executedCount} run{order.executedCount === 1 ? '' : 's'} so far
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      <span className="text-xs text-[var(--icb-text-subtle)]">
                        {order.nextRunAt
                          ? `Next run ${formatDate(order.nextRunAt, 'medium')}`
                          : 'No further runs'}
                      </span>
                    </div>
                  </div>
                  <Amount value={{ ...order.amount }} direction="debit" size="sm" />
                  {order.status === 'active' ? (
                    <CancelStandingOrderButton standingOrderId={order.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<CalendarClock size={20} />}
              title="No standing orders"
              description="Choose “Repeating” when setting up a transfer to create one."
            />
          )}
        </Card>
      </div>
    </>
  );
}
