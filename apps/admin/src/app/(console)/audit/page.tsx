import type { auditIntegritySchema, AuditEvent, OffsetPage } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import { CheckCircle2, Download, XCircle } from 'lucide-react';
import type { Metadata } from 'next';
import type { z } from 'zod';

import { AccessDenied } from '@/components/access-denied';
import { ListPagination } from '@/components/list-pagination';
import { AuditEventTable } from '@/features/audit/audit-event-table';
import { AuditFilters } from '@/features/audit/audit-filters';
import { api } from '@/lib/api';
import { isForbidden } from '@/lib/guards';

export const metadata: Metadata = { title: 'Audit trail' };

type AuditIntegrityReport = z.infer<typeof auditIntegritySchema>;

type SearchParams = Promise<{
  actorId?: string;
  action?: string;
  subjectType?: string;
  subjectId?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

/**
 * The audit explorer.
 *
 * Filters live in the URL so an investigation is a link you can paste into a case. The
 * integrity widget re-walks the hash chain on every render — a trail that cannot prove itself
 * is just a log.
 */
export default async function AuditPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = new URLSearchParams({ page: params.page ?? '1', limit: '25' });
  for (const key of ['actorId', 'action', 'subjectType', 'subjectId', 'from', 'to'] as const) {
    const value = params[key];
    if (value) {
      query.set(key, value);
    }
  }
  const suffix = query.toString();

  let page: OffsetPage<AuditEvent>;
  let integrity: AuditIntegrityReport;
  try {
    [page, integrity] = await Promise.all([
      api<OffsetPage<AuditEvent>>(`/admin/audit/events?${suffix}`),
      api<AuditIntegrityReport>('/admin/audit/integrity'),
    ]);
  } catch (error) {
    if (isForbidden(error)) {
      return <AccessDenied area="the audit trail" />;
    }
    throw error;
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Audit trail</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {page.total.toLocaleString('en-US')} event{page.total === 1 ? '' : 's'}
            {page.totalPages > 1 ? ` · page ${page.page} of ${page.totalPages}` : ''}
          </p>
        </div>
        <a
          href={`/audit/export?${suffix}`}
          download
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
        >
          <Download size={16} />
          Export NDJSON
        </a>
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Filter" description="By actor, action, subject or date range." />
          <CardBody>
            <AuditFilters values={params} />
          </CardBody>
        </Card>
        <IntegrityWidget report={integrity} />
      </div>

      <div className="mt-6">
        <AuditEventTable events={page.items} />
      </div>

      <ListPagination
        page={page.page}
        totalPages={page.totalPages}
        total={page.total}
        itemLabel={page.total === 1 ? 'event' : 'events'}
      />
    </>
  );
}

/** Hash-chain verification: every event links to its predecessor; one bad link breaks the chain. */
function IntegrityWidget({ report }: Readonly<{ report: AuditIntegrityReport }>) {
  return (
    <Card>
      <CardHeader
        title="Chain integrity"
        description={`${report.checkedEvents.toLocaleString('en-US')} events verified against their hashes`}
      />
      <CardBody>
        <p
          className={
            report.verified
              ? 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]'
              : 'flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]'
          }
        >
          {report.verified ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          {report.verified
            ? 'The chain is intact. No event has been altered or removed.'
            : `Chain broken at sequence ${report.firstBrokenSequence ?? 'unknown'}. Investigate before trusting any later event.`}
        </p>
        <p className="mt-3 text-xs text-[var(--icb-text-subtle)]">
          Checked {report.checkedAt.slice(0, 19).replace('T', ' ')} UTC
        </p>
      </CardBody>
    </Card>
  );
}
