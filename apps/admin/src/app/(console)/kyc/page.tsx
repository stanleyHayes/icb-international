import type { KycCase, OffsetPage } from '@icb/contracts';
import { Card, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'KYC queue' };

type SearchParams = Promise<{ overdue?: string; page?: string }>;

/**
 * The verification queue.
 *
 * Ordered by SLA rather than arrival: the case that has been waiting longest against its
 * deadline is the one that matters, and an overdue case is called out rather than left for an
 * operator to work out from a timestamp.
 */
export default async function KycQueuePage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const params = await searchParams;
  const query = new URLSearchParams({ page: params.page ?? '1', limit: '25' });
  if (params.overdue === 'true') query.set('overdueOnly', 'true');

  const page = await api<OffsetPage<KycCase>>(`/kyc/queue?${query.toString()}`);
  const overdue = page.items.filter((item) => isOverdue(item)).length;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">KYC queue</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {page.total} case{page.total === 1 ? '' : 's'} awaiting review
            {overdue > 0 ? ` · ${overdue} past SLA` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/kyc"
            className={filterClass(params.overdue !== 'true')}
            aria-current={params.overdue !== 'true' ? 'page' : undefined}
          >
            All
          </Link>
          <Link
            href="/kyc?overdue=true"
            className={filterClass(params.overdue === 'true')}
            aria-current={params.overdue === 'true' ? 'page' : undefined}
          >
            Overdue only
          </Link>
        </div>
      </header>

      <Card className="mt-6 overflow-hidden">
        {page.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">KYC cases awaiting review</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Requested
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Checks
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Documents
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    SLA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {page.items.map((kycCase) => (
                  <tr key={kycCase.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3">
                      <Link href={`/kyc/${kycCase.id}`} className="font-medium hover:underline">
                        {kycCase.customerName}
                      </Link>
                      <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                        {kycCase.id.slice(0, 10)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs capitalize">
                      {kycCase.requestedLevel.replaceAll('_', ' ')}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={kycCase.status} />
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <CheckSummary checks={kycCase.checks} />
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
                      {kycCase.documents.length}
                    </td>
                    <td className="px-5 py-3 text-right text-xs">
                      {isOverdue(kycCase) ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[var(--icb-danger-fg)]">
                          <AlertTriangle size={13} />
                          Overdue
                        </span>
                      ) : (
                        <span className="text-[var(--icb-text-subtle)]">
                          {formatDate(kycCase.slaDueAt, 'medium')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck size={20} />}
            title="Queue is clear"
            description="No cases are waiting for review."
          />
        )}
      </Card>

      {page.totalPages > 1 ? (
        <p className="mt-4 text-sm text-[var(--icb-text-subtle)]">
          Page {page.page} of {page.totalPages}
        </p>
      ) : null}
    </>
  );
}

/** Pass / refer / fail counts at a glance, so an operator can triage without opening the case. */
function CheckSummary({ checks }: Readonly<{ checks: KycCase['checks'] }>) {
  const passed = checks.filter((check) => check.outcome === 'pass').length;
  const referred = checks.filter((check) => check.outcome === 'refer').length;
  const failed = checks.filter((check) => check.outcome === 'fail').length;

  return (
    <span className="tabular">
      <span className="text-[var(--icb-success-fg)]">{passed}</span>
      {' / '}
      <span className={referred > 0 ? 'text-[var(--icb-warning-fg)]' : ''}>{referred}</span>
      {' / '}
      <span className={failed > 0 ? 'text-[var(--icb-danger-fg)]' : ''}>{failed}</span>
    </span>
  );
}

function isOverdue(kycCase: KycCase): boolean {
  return new Date(kycCase.slaDueAt).getTime() < Date.now() && kycCase.decision === null;
}

function filterClass(active: boolean): string {
  return active
    ? 'inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white'
    : 'inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}
