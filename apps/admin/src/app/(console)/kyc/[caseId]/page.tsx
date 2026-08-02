import type { KycCase } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { AlertTriangle, ArrowLeft, Check, HelpCircle, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DecisionForm } from '@/features/kyc/decision-form';
import { api } from '@/lib/api';

type Params = Promise<{ caseId: string }>;

export const metadata: Metadata = { title: 'KYC case' };

const CHECK_LABELS: Readonly<Record<string, string>> = {
  document_authenticity: 'Document authenticity',
  face_match: 'Face match',
  liveness: 'Liveness',
  address_verification: 'Address verification',
  sanctions_screening: 'Sanctions screening',
  pep_screening: 'PEP screening',
  adverse_media: 'Adverse media',
  business_registry: 'Business registry',
};

/**
 * One case, with everything the decision rests on.
 *
 * Checks come first and are never collapsed: an operator approving a customer is accountable for
 * having seen the screening results, so the interface does not let them be skipped past.
 */
export default async function KycCasePage({ params }: Readonly<{ params: Params }>) {
  const { caseId } = await params;
  const kycCase = await api<KycCase>(`/kyc/cases/${caseId}`);
  const decided = kycCase.decision !== null;

  return (
    <>
      <Link
        href="/kyc"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        KYC queue
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {kycCase.customerName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={kycCase.status} />
            <span className="capitalize">
              Requesting {kycCase.requestedLevel.replaceAll('_', ' ')}
            </span>
            <span className="font-mono text-xs">{kycCase.id}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--icb-text-subtle)]">SLA</p>
          <p
            className={
              new Date(kycCase.slaDueAt).getTime() < Date.now() && !decided
                ? 'flex items-center gap-1 font-medium text-[var(--icb-danger-fg)]'
                : 'font-medium'
            }
          >
            {new Date(kycCase.slaDueAt).getTime() < Date.now() && !decided ? (
              <AlertTriangle size={14} />
            ) : null}
            {formatDate(kycCase.slaDueAt, 'medium')}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader
              title="Checks"
              description="Every screening result behind this decision."
            />
            <ul className="divide-y divide-[var(--icb-border)]">
              {kycCase.checks.map((check) => (
                <li key={check.kind} className="flex items-start gap-3 px-5 py-3.5">
                  <CheckIcon outcome={check.outcome} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {CHECK_LABELS[check.kind] ?? check.kind.replaceAll('_', ' ')}
                    </p>
                    {check.detail ? (
                      <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{check.detail}</p>
                    ) : null}
                  </div>
                  {check.score !== null ? (
                    <span className="tabular shrink-0 text-xs text-[var(--icb-text-subtle)]">
                      {Math.round(check.score * 100)}%
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Documents" description={`${kycCase.documents.length} uploaded`} />
            {kycCase.documents.length > 0 ? (
              <ul className="divide-y divide-[var(--icb-border)]">
                {kycCase.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">
                        {document.type.replaceAll('_', ' ')}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                        Uploaded {formatDate(document.uploadedAt, 'medium')}
                        {document.expiresOn
                          ? ` · expires ${formatDate(document.expiresOn, 'medium')}`
                          : ''}
                      </p>
                      {document.rejectionReason ? (
                        <p className="mt-1 text-xs text-[var(--icb-danger-fg)]">
                          {document.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={document.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <CardBody className="pt-0 text-sm text-[var(--icb-text-muted)]">
                No documents have been uploaded for this case.
              </CardBody>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            title={decided ? 'Decision' : 'Decide'}
            description={
              decided
                ? 'This case has been decided and is on the record.'
                : 'Four-eyes does not apply to KYC, but every decision is attributed and audited.'
            }
          />
          <CardBody className="pt-0">
            {kycCase.decision ? (
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Outcome</dt>
                  <dd>
                    <StatusBadge status={kycCase.decision.outcome} />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">Tier granted</dt>
                  <dd className="capitalize">
                    {kycCase.decision.grantedLevel?.replaceAll('_', ' ') ?? 'None'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-[var(--icb-text-subtle)]">By</dt>
                  <dd>{kycCase.decision.decidedBy}</dd>
                </div>
                <div className="border-t border-[var(--icb-border)] pt-3">
                  <dt className="text-[var(--icb-text-subtle)]">Reason</dt>
                  <dd className="mt-1">{kycCase.decision.reason}</dd>
                </div>
              </dl>
            ) : (
              <DecisionForm caseId={kycCase.id} requestedLevel={kycCase.requestedLevel} />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function CheckIcon({ outcome }: Readonly<{ outcome: KycCase['checks'][number]['outcome'] }>) {
  if (outcome === 'pass') {
    return (
      <Check size={17} className="mt-0.5 shrink-0 text-[var(--icb-success)]" aria-label="Passed" />
    );
  }
  if (outcome === 'fail') {
    return <X size={17} className="mt-0.5 shrink-0 text-[var(--icb-danger)]" aria-label="Failed" />;
  }
  return (
    <HelpCircle
      size={17}
      className="mt-0.5 shrink-0 text-[var(--icb-warning)]"
      aria-label={outcome === 'refer' ? 'Referred' : 'Pending'}
    />
  );
}
