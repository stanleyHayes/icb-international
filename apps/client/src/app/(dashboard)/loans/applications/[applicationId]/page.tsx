import type { LoanApplication } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AcceptOfferButton } from '@/features/loans/loan-forms';
import { api } from '@/lib/api';

type Params = Promise<{ applicationId: string }>;

export const metadata: Metadata = { title: 'Loan application' };

const STAGES = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'decided', label: 'Decision' },
] as const;

/**
 * Where an application stands.
 *
 * The decision is shown with its factors, not just its outcome: a decline that cannot be
 * explained cannot be acted on, and an approval should show what carried it.
 */
export default async function ApplicationPage({ params }: Readonly<{ params: Params }>) {
  const { applicationId } = await params;
  const application = await api<LoanApplication>(`/loans/applications/${applicationId}`, {
    tags: ['loans'],
  });
  const stage = stageIndex(application);

  return (
    <>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Loans
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
            {application.productName}
          </h1>
          <p className="mt-1.5 font-mono text-xs text-[var(--icb-text-subtle)]">
            {application.reference} · <Amount value={application.requestedAmount} size="sm" /> over{' '}
            {application.termMonths} months
          </p>
        </div>
        <StatusBadge status={application.status} />
      </header>

      <Card className="mt-6">
        <CardHeader title="Progress" />
        <CardBody className="pt-0">
          <ol className="flex gap-2">
            {STAGES.map((item, index) => (
              <li
                key={item.key}
                aria-current={index === stage ? 'step' : undefined}
                className={
                  index <= stage
                    ? 'flex-1 rounded-full bg-[var(--icb-primary)] px-3 py-1.5 text-center text-xs font-semibold text-white'
                    : 'flex-1 rounded-full bg-[var(--icb-bg-muted)] px-3 py-1.5 text-center text-xs font-medium text-[var(--icb-text-subtle)]'
                }
              >
                {item.label}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-[var(--icb-text-subtle)]">
            Applied {formatDate(application.createdAt, 'medium')} · last update{' '}
            {formatDate(application.updatedAt, 'medium')}
          </p>
        </CardBody>
      </Card>

      {application.decision ? <DecisionPanel application={application} /> : null}

      {application.offer && application.offer.acceptedAt === null ? (
        <Card className="mt-6">
          <CardHeader
            title="Your offer"
            description={`Valid until ${formatDate(application.offer.expiresAt, 'medium')}. Accepting creates the loan and pays out the money.`}
          />
          <CardBody className="pt-0">
            <dl className="space-y-2 text-sm">
              <Row label="Amount">
                <Amount value={application.offer.amount} size="lg" />
              </Row>
              <Row label="Rate">
                <span className="tabular font-semibold">{application.offer.rate}%</span>
              </Row>
              <Row label="Monthly instalment">
                <Amount value={application.offer.instalment} size="sm" />
              </Row>
            </dl>
            <div className="mt-5">
              <AcceptOfferButton applicationId={application.id} />
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

function stageIndex(application: LoanApplication): number {
  if (application.decision || application.offer || application.status === 'declined') {
    return 2;
  }
  if (application.status === 'under_review') {
    return 1;
  }
  return 0;
}

function DecisionPanel({ application }: Readonly<{ application: LoanApplication }>) {
  const decision = application.decision;
  if (!decision) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="The decision"
        description={`Score ${decision.score} · ${decision.band.replace('_', ' ')} · decided ${formatDate(decision.decidedAt, 'medium')}`}
      />
      <CardBody className="pt-0">
        {decision.reasons.length > 0 ? (
          <ul className="mb-4 space-y-1.5 text-sm text-[var(--icb-text-muted)]">
            {decision.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden="true">·</span>
                {reason}
              </li>
            ))}
          </ul>
        ) : null}

        <ul className="space-y-1.5">
          {decision.factors.map((factor) => (
            <li
              key={factor.code}
              className="flex items-baseline justify-between gap-4 text-xs text-[var(--icb-text-muted)]"
            >
              <span>{factor.label}</span>
              <span
                className={
                  factor.contribution >= 0
                    ? 'tabular text-[var(--icb-success-fg)]'
                    : 'tabular text-[var(--icb-danger-fg)]'
                }
              >
                {factor.contribution >= 0 ? '+' : ''}
                {factor.contribution}
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
