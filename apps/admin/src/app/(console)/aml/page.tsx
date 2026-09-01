import { AML_ALERT_KINDS, type AmlAlert, type OffsetPage } from '@icb/contracts';
import { Card, EmptyState } from '@icb/ui';
import { ShieldCheck } from 'lucide-react';
import type { Metadata, Route } from 'next';

import { AlertTable } from '@/features/aml/alert-table';
import { ListPagination } from '@/components/list-pagination';
import { FilterPills, type FilterPill } from '@/features/fraud/filter-pills';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'AML alerts' };

type SearchParams = Promise<{ kind?: string; severity?: string; status?: string; page?: string }>;

const STATUSES = ['open', 'investigating', 'escalated'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

type Filters = {
  kind?: string | undefined;
  severity?: string | undefined;
  status?: string | undefined;
};

function hrefFor(filters: Filters, page?: number): Route {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  if (page) params.set('page', String(page));
  const query = params.toString();
  return query ? `/aml?${query}` : '/aml';
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

function apiQueryFor(params: Filters & { page?: string }): string {
  const query = new URLSearchParams({ page: params.page ?? '1', limit: '25' });
  appendArrayParam(query, 'kind', params.kind);
  appendArrayParam(query, 'severity', params.severity);
  appendArrayParam(query, 'status', params.status);
  return query.toString();
}

function toggle(current: string | undefined, value: string): string | undefined {
  return current === value ? undefined : value;
}

function pillsFor(values: readonly string[], filters: Filters, key: keyof Filters): FilterPill[] {
  return values.map((value) => ({
    key: value,
    label: value.replaceAll('_', ' '),
    href: hrefFor({ ...filters, [key]: toggle(filters[key], value) }),
    active: filters[key] === value,
  }));
}

function kindPillsFor(filters: Filters): FilterPill[] {
  return [
    {
      key: 'all',
      label: 'All',
      href: hrefFor({ ...filters, kind: undefined }),
      active: !filters.kind,
    },
    ...pillsFor(AML_ALERT_KINDS, filters, 'kind'),
  ];
}

/**
 * The AML queue: screening hits and transaction-monitoring alerts in one list.
 */
export default async function AmlQueuePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const page = await api<OffsetPage<AmlAlert>>(`/admin/aml/alerts?${apiQueryFor(params)}`);
  const filters: Filters = {
    kind: params.kind,
    severity: params.severity,
    status: params.status,
  };

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">AML alerts</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          {page.total} alert{page.total === 1 ? '' : 's'} — screening hits and transaction
          monitoring
        </p>
      </header>

      <Card className="mt-5 space-y-3 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <FilterPills label="Kind" pills={kindPillsFor(filters)} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <FilterPills label="Severity" pills={pillsFor(SEVERITIES, filters, 'severity')} />
          <FilterPills label="Status" pills={pillsFor(STATUSES, filters, 'status')} />
        </div>
      </Card>

      <div className="mt-6">
        {page.items.length > 0 ? (
          <AlertTable items={page.items} />
        ) : (
          <Card>
            <EmptyState
              icon={<ShieldCheck size={20} />}
              title="Queue is clear"
              description="No AML alerts match these filters."
            />
          </Card>
        )}
      </div>

      <ListPagination
        page={page.page}
        totalPages={page.totalPages}
        total={page.total}
        itemLabel={page.total === 1 ? 'alert' : 'alerts'}
      />
    </>
  );
}
