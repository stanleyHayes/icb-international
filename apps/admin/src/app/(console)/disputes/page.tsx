import { DISPUTE_STAGES, type CursorPage, type Dispute } from '@icb/contracts';
import { Card, EmptyState } from '@icb/ui';
import { ShieldCheck } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { DisputeTable, isDisputeOverdue } from '@/features/disputes/dispute-table';
import { FilterPills, type FilterPill } from '@/features/fraud/filter-pills';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Disputes' };

type SearchParams = Promise<{ stage?: string; overdue?: string; cursor?: string }>;

function hrefFor(stage: string | undefined, overdue: boolean, cursor?: string | null): Route {
  const params = new URLSearchParams();
  if (stage) params.set('stage', stage);
  if (overdue) params.set('overdue', 'true');
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  return query ? `/disputes?${query}` : '/disputes';
}

/**
 * Appends an array filter as a repeated key — twice when only one value is selected, because
 * the API's querystring parser only produces an array for a repeated key (a bare single value
 * fails the contract's `z.array(...)` with a 422).
 */
function appendArrayParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (!value) return;
  params.append(key, value);
  params.append(key, value);
}

function stagePills(stage: string | undefined, overdue: boolean): FilterPill[] {
  return [
    { key: 'all', label: 'All', href: hrefFor(undefined, overdue), active: stage === undefined },
    ...DISPUTE_STAGES.map((candidate) => ({
      key: candidate,
      label: candidate.replaceAll('_', ' '),
      href: hrefFor(stage === candidate ? undefined : candidate, overdue),
      active: stage === candidate,
    })),
    {
      key: 'overdue',
      label: 'Overdue only',
      href: hrefFor(stage, !overdue),
      active: overdue,
    },
  ];
}

/**
 * The dispute queue, organised by stage.
 *
 * The API orders by the tightest SLA deadline first; the stage pills narrow the view without
 * changing that order.
 */
export default async function DisputesQueuePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const overdue = params.overdue === 'true';
  const query = new URLSearchParams({ limit: '25' });
  if (params.cursor) query.set('cursor', params.cursor);
  appendArrayParam(query, 'stage', params.stage);
  if (overdue) query.set('overdueOnly', 'true');

  const page = await api<CursorPage<Dispute>>(`/disputes/admin/queue?${query.toString()}`);
  const overdueCount = page.items.filter(isDisputeOverdue).length;

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Disputes</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {page.items.length} dispute{page.items.length === 1 ? '' : 's'} shown, tightest deadline
          first
          {overdueCount > 0 ? ` · ${overdueCount} past SLA` : ''}
        </p>
      </header>

      <div className="mt-5">
        <FilterPills label="Stage" pills={stagePills(params.stage, overdue)} />
      </div>

      <div className="mt-6">
        {page.items.length > 0 ? (
          <DisputeTable items={page.items} />
        ) : (
          <Card>
            <EmptyState
              icon={<ShieldCheck size={20} />}
              title="Queue is clear"
              description="No disputes match these filters."
            />
          </Card>
        )}
      </div>

      {page.hasMore && page.nextCursor ? (
        <p className="mt-4 text-sm">
          <Link
            href={hrefFor(params.stage, overdue, page.nextCursor)}
            className="font-medium text-[var(--icb-primary)] hover:underline"
          >
            Next page
          </Link>
        </p>
      ) : null}
    </>
  );
}
