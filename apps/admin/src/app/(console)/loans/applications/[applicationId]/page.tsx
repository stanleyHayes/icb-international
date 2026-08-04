import type { LoanApplication } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DecisionForm } from '@/features/loans/decision-form';
import { LOAN_PATHS } from '@/features/loans/loans.constants';
import { Scorecard } from '@/features/loans/scorecard';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Loan application' };

type Params = Promise<{ applicationId: string }>;

/** Statuses in which a human decision can still be recorded. */
const DECIDABLE_STATUSES = new Set(['submitted', 'under_review']);

/**
 * One application, with everything the decision rests on.
 *
 * The scorecard is shown in full — factors, weights, reasons — because an underwriter
 * approving or declining against a number they cannot see the composition of is guessing.
 */
export default async function LoanApplicationPage({ params }: Readonly<{ params: Params }>) {
  const { applicationId } = await params;
  const application = await api<LoanApplication>(LOAN_PATHS.application(applicationId));
  const decidable = DECIDABLE_STATUSES.has(application.status);

  return (
    <>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Lending
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {application.reference}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={application.status} />
            <span>{application.productName}</span>
            <span className="capitalize">{application.purpose.replaceAll('_', ' ')}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--icb-text-subtle)]">Requested</p>
          <Amount value={application.requestedAmount} size="xl" />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {application.decision ? (
            <Scorecard decision={application.decision} />
          ) : (
            <Card>
              <CardBody className="text-sm text-[var(--icb-text-muted)]">
                The scorecard has not assessed this application yet.
              </CardBody>
            </Card>
          )}
          <DetailsCard application={application} />
        </div>

        <Card>
          <CardHeader
            title={decidable ? 'Decide' : 'Decision'}
            description={
              decidable
                ? 'The scorecard recommends; you decide. Every decision is attributed and audited.'
                : 'This application has been decided and is on the record.'
            }
          />
          <CardBody className="pt-0">
            {decidable ? (
              <DecisionForm
                applicationId={application.id}
                currency={application.requestedAmount.currency}
                requestedAmountMinorUnits={application.requestedAmount.minorUnits}
                scorecardRate={application.decision?.approvedRate ?? null}
              />
            ) : (
              <DecisionSummary application={application} />
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function DetailsCard({ application }: Readonly<{ application: LoanApplication }>) {
  return (
    <Card>
      <CardHeader title="Application" description={`Customer ${application.customerId.slice(0, 10)}`} />
      <CardBody className="pt-0">
        <dl className="space-y-3 text-sm">
          <Row label="Term" value={`${application.termMonths} months · ${application.frequency}`} />
          <Row
            label="Submitted"
            value={application.submittedAt ? formatDate(application.submittedAt, 'medium') : 'Not yet'}
          />
          <Row label="Documents" value={String(application.documents.length)} />
          {application.offer ? (
            <Row
              label="Offer"
              value={`${application.offer.rate}% · expires ${formatDate(application.offer.expiresAt, 'medium')}`}
            />
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );
}

function DecisionSummary({ application }: Readonly<{ application: LoanApplication }>) {
  const decision = application.decision;
  if (!decision) {
    return <p className="text-sm text-[var(--icb-text-muted)]">No decision is on record.</p>;
  }
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-[var(--icb-text-subtle)]">Outcome</dt>
        <dd>
          <StatusBadge status={decision.outcome} />
        </dd>
      </div>
      <Row label="By" value={decision.decidedBy} />
      <Row label="When" value={formatDate(decision.decidedAt, 'medium')} />
      {decision.approvedAmount ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[var(--icb-text-subtle)]">Approved</dt>
          <dd>
            <Amount value={decision.approvedAmount} size="sm" />
            {decision.approvedRate !== null ? (
              <span className="ml-2 text-xs text-[var(--icb-text-subtle)]">
                at {decision.approvedRate}%
              </span>
            ) : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
