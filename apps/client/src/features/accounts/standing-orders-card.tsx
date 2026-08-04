import type { StandingOrder, TransferDestination } from '@icb/contracts';
import { Amount, Card, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Repeat } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';

function destinationLabel(destination: TransferDestination): string {
  switch (destination.kind) {
    case 'own_account':
      return 'Between your accounts';
    case 'icb_customer':
      return `ICB customer ··${destination.accountNumber.slice(-4)}`;
    case 'domestic_bank':
      return `${destination.accountHolderName} ··${destination.accountNumber.slice(-4)}`;
    case 'international':
      return `${destination.accountHolderName} (${destination.country})`;
    case 'beneficiary':
      return 'Saved payee';
  }
}

/**
 * Standing orders leaving this account.
 *
 * The endpoint returns all of the customer's standing orders; filtering here keeps the account
 * page self-contained, and the next run date is what a customer actually scans for.
 */
export async function StandingOrdersCard({ accountId }: Readonly<{ accountId: string }>) {
  const all = await api<StandingOrder[]>('/standing-orders', { tags: ['transfers'] });
  const orders = all
    .filter((order) => order.fromAccountId === accountId)
    .sort((a, b) => (a.nextRunAt ?? '').localeCompare(b.nextRunAt ?? ''));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Standing orders"
        action={
          <Link
            href="/transfer"
            className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
          >
            Set one up
          </Link>
        }
      />
      {orders.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{order.name}</span>
                  <StatusBadge status={order.status} />
                </p>
                <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                  {destinationLabel(order.destination)}
                  {order.nextRunAt
                    ? ` · next ${formatDate(order.nextRunAt, 'medium')}`
                    : ' · no further runs'}
                </p>
              </div>
              <Amount value={order.amount} direction="debit" size="sm" className="shrink-0" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Repeat size={20} />}
          title="No standing orders"
          description="Regular payments from this account will appear here."
        />
      )}
    </Card>
  );
}
