import type { Dispute } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, Timeline, formatDate } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError, api } from '@/lib/api';

export const metadata: Metadata = { title: 'Dispute' };

function labelOf(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

async function loadDispute(disputeId: string): Promise<Dispute> {
  try {
    return await api<Dispute>(`/disputes/${disputeId}`, { tags: ['disputes'] });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

/**
 * One dispute, end to end: what was challenged, the stage it has reached, the full stage
 * history, any provisional credit, and the evidence on file. The timeline is the case.
 */
export default async function DisputeDetailPage({
  params,
}: Readonly<{ params: Promise<{ disputeId: string }> }>) {
  const { disputeId } = await params;
  const dispute = await loadDispute(disputeId);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
            {labelOf(dispute.reason)}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {dispute.reference} · opened {formatDate(dispute.createdAt, 'medium')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Amount value={dispute.amount} size="lg" />
          <StatusBadge status={dispute.stage} />
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Progress" description="Every stage the case has passed through." />
          <CardBody className="pt-0">
            <Timeline
              items={dispute.timeline.map((entry, index) => ({
                id: `${entry.at}-${index}`,
                title: labelOf(entry.stage),
                description: entry.note,
                timestamp: entry.at,
              }))}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="The case" />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <Row label="What happened" value={dispute.detail} />
                <Row
                  label="Outcome"
                  value={
                    dispute.outcome ? (
                      <StatusBadge status={dispute.outcome} />
                    ) : (
                      `Not decided — due by ${formatDate(dispute.slaDueAt, 'medium')}`
                    )
                  }
                />
                {dispute.resolvedAt ? (
                  <Row label="Resolved" value={formatDate(dispute.resolvedAt, 'long')} />
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {dispute.provisionalCredit ? (
            <Card>
              <CardHeader
                title="Provisional credit"
                description="Credited while the case is decided. It becomes final if you win, and is reclaimed if you do not."
              />
              <CardBody className="pt-0">
                <Amount value={dispute.provisionalCredit.amount} size="lg" direction="credit" />
                <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">
                  Granted {formatDate(dispute.provisionalCredit.grantedAt, 'medium')}
                  {dispute.provisionalCredit.clawedBackAt
                    ? ` · reclaimed ${formatDate(dispute.provisionalCredit.clawedBackAt, 'medium')}`
                    : ''}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Evidence" />
            <CardBody className="pt-0">
              {dispute.evidence.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {dispute.evidence.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-4">
                      <span className="min-w-0 truncate">{item.label}</span>
                      <span className="shrink-0 text-xs text-[var(--icb-text-subtle)]">
                        {item.uploadedBy === 'customer' ? 'You' : labelOf(item.uploadedBy)} ·{' '}
                        {formatDate(item.uploadedAt, 'medium')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--icb-text-muted)]">
                  No evidence on file yet. If we need anything from you, we will ask in a secure
                  message.
                </p>
              )}
            </CardBody>
          </Card>

          <p className="text-sm text-[var(--icb-text-muted)]">
            Questions about this case?{' '}
            <Link href="/support/tickets/new" className="font-medium text-[var(--icb-primary)] hover:underline">
              Message us
            </Link>{' '}
            and quote {dispute.reference}.
          </p>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
