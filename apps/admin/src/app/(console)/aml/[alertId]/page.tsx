import type { AmlAlert } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import {
  FiledReportView,
  MatchDetailCard,
  NarrativeCard,
  RelatedTransactionsCard,
} from '@/features/aml/alert-panels';
import { CaseWorkflow } from '@/features/aml/case-workflow';
import { ReportForm } from '@/features/aml/report-form';
import { SeverityBadge } from '@/features/fraud/severity-badge';
import { api } from '@/lib/api';
import { readSession } from '@/lib/session';

type Params = Promise<{ alertId: string }>;

export const metadata: Metadata = { title: 'AML case' };

/**
 * One AML case: what matched and why on the left, workflow and filing on the right.
 */
export default async function AmlCasePage({ params }: Readonly<{ params: Params }>) {
  const { alertId } = await params;
  const [alert, session] = await Promise.all([
    api<AmlAlert>(`/admin/aml/alerts/${alertId}`),
    readSession(),
  ]);
  const assignedToMe = session !== null && alert.assignedTo === session.user.userId;

  return (
    <>
      <Link
        href="/aml"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        AML alerts
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {alert.customerName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
            <span className="capitalize">{alert.kind.replaceAll('_', ' ')}</span>
            <span className="font-mono text-xs">{alert.reference}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--icb-text-subtle)]">Aggregate amount</p>
          {alert.aggregateAmount ? (
            <Amount value={alert.aggregateAmount} size="xl" />
          ) : (
            <p className="font-medium text-[var(--icb-text-subtle)]">—</p>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <MatchDetailCard alert={alert} />
          <RelatedTransactionsCard alert={alert} />
          <NarrativeCard narrative={alert.narrative} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Case workflow" description="Assign, move, and narrate the case." />
            <CardBody className="pt-0">
              <CaseWorkflow
                alertId={alert.id}
                currentStatus={alert.status}
                assigned={assignedToMe}
                narrative={alert.narrative}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="SAR / CTR filing"
              description={
                alert.filedReport ? 'The filing on record.' : 'Draft and file the regulatory report.'
              }
            />
            <CardBody className="pt-0">
              {alert.filedReport ? (
                <FiledReportView report={alert.filedReport} />
              ) : (
                <ReportForm alertId={alert.id} draftNarrative={alert.narrative} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
