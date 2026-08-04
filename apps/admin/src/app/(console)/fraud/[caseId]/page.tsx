import type { RiskCase } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate, formatTime } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { CaseActions } from '@/features/fraud/case-actions';
import { ExplainabilityPanel } from '@/features/fraud/explainability-panel';
import { SeverityBadge } from '@/features/fraud/severity-badge';
import { api } from '@/lib/api';

type Params = Promise<{ caseId: string }>;

export const metadata: Metadata = { title: 'Fraud case' };

/**
 * One fraud case: the score and its reasoning on the left, the decision on the right.
 */
export default async function FraudCasePage({ params }: Readonly<{ params: Params }>) {
  const { caseId } = await params;
  const riskCase = await api<RiskCase>(`/risk/cases/${caseId}`);
  const resolved = riskCase.resolution !== null;

  return (
    <>
      <Link
        href="/fraud"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Fraud alerts
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {riskCase.customerName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <SeverityBadge severity={riskCase.severity} />
            <StatusBadge status={riskCase.status} />
            <span className="font-mono text-xs">{riskCase.reference}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--icb-text-subtle)]">Amount at risk</p>
          {riskCase.amountAtRisk ? (
            <Amount value={riskCase.amountAtRisk} size="xl" />
          ) : (
            <p className="font-medium text-[var(--icb-text-subtle)]">None</p>
          )}
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <ExplainabilityPanel assessment={riskCase.assessment} />

          <Card>
            <CardHeader title="Subject" description="What the assessment scored." />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Type</dt>
                  <dd className="capitalize">
                    {riskCase.assessment.subjectType.replaceAll('_', ' ')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Reference</dt>
                  <dd className="font-mono text-xs">{riskCase.assessment.subjectId}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Assessed</dt>
                  <dd>
                    {formatDate(riskCase.assessment.assessedAt, 'medium')}{' '}
                    {formatTime(riskCase.assessment.assessedAt)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Assigned to</dt>
                  <dd>{riskCase.assignedTo ?? 'Unclaimed'}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title={resolved ? 'Resolution' : 'Resolve'}
            description={
              resolved
                ? 'This case has been resolved and is on the record.'
                : 'Claim the case, then record what you decided and why.'
            }
          />
          <CardBody className="pt-0">
            {riskCase.resolution ? (
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Action</dt>
                  <dd className="font-medium capitalize">
                    {riskCase.resolution.action.replaceAll('_', ' ')}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">By</dt>
                  <dd>{riskCase.resolution.by}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">At</dt>
                  <dd>
                    {formatDate(riskCase.resolution.at, 'medium')}{' '}
                    {formatTime(riskCase.resolution.at)}
                  </dd>
                </div>
                <div className="border-t border-[var(--icb-border)] pt-3">
                  <dt className="text-[var(--icb-text-subtle)]">Note</dt>
                  <dd className="mt-1">{riskCase.resolution.note}</dd>
                </div>
              </dl>
            ) : (
              <CaseActions caseId={riskCase.id} assignedTo={riskCase.assignedTo} />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
