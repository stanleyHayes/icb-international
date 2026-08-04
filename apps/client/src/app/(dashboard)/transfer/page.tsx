import type { CursorPage, StandingOrder, TransferSummary, TransferTemplate } from '@icb/contracts';
import { Card, CardHeader, EmptyState } from '@icb/ui';
import { ArrowLeftRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RailGrid } from '@/features/transfer/rail-grid';
import { TransferList } from '@/features/transfer/transfer-list';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Move money' };

/**
 * The transfers hub: pick a rail, then land on the priced flow. History, scheduled payments,
 * templates and payees are one tap from here.
 */
export default async function TransferHubPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ from?: string }> }>) {
  const { from } = await searchParams;
  const fromQuery = from ? `&from=${from}` : '';

  const [transfersPage, standingOrders, templates] = await Promise.all([
    api<CursorPage<TransferSummary>>('/transfers?limit=8', { tags: ['transfers'] }),
    api<StandingOrder[]>('/standing-orders', { tags: ['standing-orders'] }),
    api<TransferTemplate[]>('/transfer-templates', { tags: ['transfer-templates'] }),
  ]);

  const upcoming = transfersPage.items.filter((transfer) => transfer.status === 'scheduled');

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Move money</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Choose how to send. You will always see the fee and arrival time before anything moves.
        </p>
      </header>

      <RailGrid fromQuery={fromQuery} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Recent transfers" />
          {transfersPage.items.length > 0 ? (
            <TransferList transfers={transfersPage.items} />
          ) : (
            <EmptyState
              icon={<ArrowLeftRight size={20} />}
              title="No transfers yet"
              description="Your first transfer will appear here with its full status history."
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Upcoming"
              action={
                <Link
                  href="/transfer/scheduled"
                  className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
                >
                  View all
                </Link>
              }
            />
            <div className="px-5 pb-5 text-sm text-[var(--icb-text-muted)]">
              {upcoming.length + standingOrders.length > 0 ? (
                <p>
                  {upcoming.length} scheduled transfer{upcoming.length === 1 ? '' : 's'} and{' '}
                  {standingOrders.length} standing order{standingOrders.length === 1 ? '' : 's'}{' '}
                  active.
                </p>
              ) : (
                <p>
                  Nothing scheduled. Set up a future-dated or repeating transfer from any rail.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Templates"
              action={
                <Link
                  href="/transfer/templates"
                  className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
                >
                  Manage
                </Link>
              }
            />
            <div className="px-5 pb-5 text-sm text-[var(--icb-text-muted)]">
              {templates.length > 0 ? (
                <p>
                  {templates.length} saved template{templates.length === 1 ? '' : 's'} ready to
                  re-run.
                </p>
              ) : (
                <p>Save any transfer as a template at the confirmation step.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
