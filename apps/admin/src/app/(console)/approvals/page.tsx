import { Button, Card, Select } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { listApprovals } from '@/features/approvals/api';
import { ApprovalsTable } from '@/features/approvals/approvals-table';
import { APPROVAL_KIND_OPTIONS } from '@/features/approvals/kind-labels';
import type { Route } from 'next';

export const metadata: Metadata = { title: 'Approvals' };

type SearchParams = Promise<{ status?: string; kind?: string }>;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
] as const;

/**
 * Build an in-app URL that carries a query string.
 *
 * Returns `Route` rather than `string` so callers can pass it straight to `<Link href>`. The
 * assertion lives here, once: `typedRoutes` describes path shapes and cannot know a
 * query-string variant, and inline `as Route` at the call site gets deleted by
 * `eslint --fix` whenever the dev route table makes it look redundant.
 */
function filterHref(status: string, kind?: string): Route {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (kind) query.set('kind', kind);
  const text = query.toString();
  return (text ? `/approvals?${text}` : '/approvals') as Route;
}

function pillClass(active: boolean): string {
  return active
    ? 'inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white'
    : 'inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}

/**
 * The maker-checker inbox.
 *
 * One queue for every privileged action that needs a second pair of eyes — high-value
 * transfers, manual postings, limit changes, refunds and more. Pending work is ordered oldest
 * first by the API, because the request that has waited longest is the one that matters.
 */
export default async function ApprovalsPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const status = params.status ?? '';
  const kind = params.kind ?? '';
  const approvals = await listApprovals({
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
  });
  const pending = approvals.filter((item) => item.status === 'pending').length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Approvals</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {pending} request{pending === 1 ? '' : 's'} waiting for a second operator
          </p>
        </div>
        <form method="get" action="/approvals" className="flex items-end gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--icb-text-subtle)]">
            Kind
            <Select key={kind} name="kind" defaultValue={kind} className="min-w-[180px]">
              <option value="">All kinds</option>
              {APPROVAL_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="secondary" size="md">
            Filter
          </Button>
        </form>
      </header>

      <nav aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = status === filter.value;
          return (
            <Link
              key={filter.value}
              href={filterHref(filter.value, kind || undefined)}
              aria-current={active ? 'page' : undefined}
              className={pillClass(active)}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Card className="mt-4 overflow-hidden">
        <ApprovalsTable approvals={approvals} />
      </Card>
    </>
  );
}
