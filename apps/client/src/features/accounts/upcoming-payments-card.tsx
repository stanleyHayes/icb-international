import type { CursorPage, StandingOrder, TransferSummary } from '@icb/contracts';
import { Amount, Card, CardHeader, EmptyState, formatDate } from '@icb/ui';
import { CalendarClock } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';

interface UpcomingItem {
  key: string;
  label: string;
  when: string;
  amount: { minorUnits: number; currency: string; scale: number };
}

/**
 * Money that is about to leave: scheduled transfers and the next run of each standing order.
 *
 * The `status` key is repeated deliberately — the API validates it as an array and its
 * querystring parser only makes an array out of a repeated key.
 */
export async function UpcomingPaymentsCard() {
  const [scheduled, standingOrders] = await Promise.all([
    api<CursorPage<TransferSummary>>('/transfers?status=scheduled&status=scheduled&limit=10', {
      tags: ['transfers'],
    }),
    api<StandingOrder[]>('/standing-orders', { tags: ['transfers'] }),
  ]);

  const items: UpcomingItem[] = [
    ...scheduled.items.map((transfer) => ({
      key: transfer.id,
      label: transfer.recipientName,
      when: transfer.executeAt,
      amount: transfer.debitAmount,
    })),
    ...standingOrders
      .filter((order) => order.status === 'active' && order.nextRunAt !== null)
      .map((order) => ({
        key: order.id,
        label: order.name,
        when: order.nextRunAt as string,
        amount: order.amount,
      })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 5);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Upcoming payments"
        action={
          <Link
            href="/transfer"
            className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
          >
            New payment
          </Link>
        }
      />
      {items.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {items.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.label}</p>
                <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                  {formatDate(item.when, 'medium')}
                </p>
              </div>
              <Amount value={item.amount} direction="debit" size="sm" className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarClock size={20} />}
          title="Nothing scheduled"
          description="Scheduled transfers and standing orders will appear here."
        />
      )}
    </Card>
  );
}
