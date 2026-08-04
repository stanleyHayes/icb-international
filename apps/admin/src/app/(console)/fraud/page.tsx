import type { OffsetPage, RiskCase } from '@icb/contracts';
import { Card, EmptyState } from '@icb/ui';
import { ShieldCheck } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { CaseTable } from '@/features/fraud/case-table';
import { FilterPills, type FilterPill } from '@/features/fraud/filter-pills';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Fraud alerts' };

type SearchParams = Promise<{ severity?: string; status?: string; page?: string }>;

const STATUSES = ['open', 'investigating', 'escalated'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

function hrefFor(severity: string | undefined, status: string | undefined, page?: number): Route {
  const params = new URLSearchParams();
  if (severity) params.set('severity', severity);
  if (status) params.set('status', status);
  if (page) params.set('page', String(page));
  const query = params.toString();
  return query ? `/fraud?${query}` : '/fraud';
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

function pillsFor(
  values: readonly string[],
  current: string | undefined,
  href: (value: string | undefined) => Route,
): FilterPill[] {
  return [
    { key: 'all', label: 'All', href: href(undefined), active: current === undefined },
    ...values.map((value) => ({
      key: value,
      label: value,
      href: href(value),
      active: current === value,
    })),
  ];
}

/**
 * The fraud alert queue.
 *
 * Filterable by severity and status; the case that scores highest against the tightest deadline
 * is the one an analyst should see first, so the API orders, the page only filters.
 */
export default async function FraudQueuePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = new URLSearchParams({ page: params.page ?? '1', limit: '25' });
  appendArrayParam(query, 'severity', params.severity);
  appendArrayParam(query, 'status', params.status);

  const page = await api<OffsetPage<RiskCase>>(`/risk/cases?${query.toString()}`);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Fraud alerts</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {page.total} case{page.total === 1 ? '' : 's'} on the queue ·{' '}
            <Link href="/fraud/rules" className="font-medium text-[var(--icb-primary)] hover:underline">
              Detection rules
            </Link>
          </p>
        </div>
      </header>

      <div className="mt-5 space-y-2">
        <FilterPills
          label="Status"
          pills={pillsFor(STATUSES, params.status, (status) => hrefFor(params.severity, status))}
        />
        <FilterPills
          label="Severity"
          pills={pillsFor(SEVERITIES, params.severity, (severity) => hrefFor(severity, params.status))}
        />
      </div>

      <div className="mt-6">
        {page.items.length > 0 ? (
          <CaseTable items={page.items} />
        ) : (
          <Card>
            <EmptyState
              icon={<ShieldCheck size={20} />}
              title="Queue is clear"
              description="No fraud cases match these filters."
            />
          </Card>
        )}
      </div>

      {page.totalPages > 1 ? (
        <p className="mt-4 text-sm text-[var(--icb-text-subtle)]">
          Page {page.page} of {page.totalPages}
          {page.page < page.totalPages ? (
            <>
              {' · '}
              <Link
                href={hrefFor(params.severity, params.status, page.page + 1)}
                className="font-medium text-[var(--icb-primary)] hover:underline"
              >
                Next page
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </>
  );
}
