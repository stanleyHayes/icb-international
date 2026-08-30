import { Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApiError } from '@/lib/api';
import { readSession } from '@/lib/session';
import { getApproval } from '@/features/approvals/api';
import { AmountHeader, DecisionSection } from '@/features/approvals/decision-section';
import { ExpiryCountdown } from '@/features/approvals/expiry-countdown';
import { approvalKindLabel } from '@/features/approvals/kind-labels';
import { PayloadView } from '@/features/approvals/payload-view';

type Params = Promise<{ approvalId: string }>;

export const metadata: Metadata = { title: 'Approval request' };

function Row({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right break-all">{value}</dd>
    </div>
  );
}

/**
 * One approval request, reviewed the way a checker actually works: what is being asked, what
 * changes, who asked, how long is left — then the decision.
 */
export default async function ApprovalDetailPage({
  params,
}: Readonly<{ params: Params }>) {
  const { approvalId } = await params;
  const [session, approval] = await Promise.all([
    readSession(),
    getApproval(approvalId).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);
  if (!approval) {
    notFound();
  }

  const isSelf = session?.user.userId === approval.requestedBy;

  return (
    <>
      <Link
        href="/approvals"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Approvals inbox
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">{approval.summary}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            {approvalKindLabel(approval.kind)}
            <StatusBadge status={approval.status} />
          </p>
        </div>
        <AmountHeader amount={approval.amount} />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Request" />
          <CardBody className="pt-0">
            <dl className="space-y-3 text-sm">
              <Row
                label="Request id"
                value={<span className="font-mono text-xs">{approval.id}</span>}
              />
              <Row label="Raised by" value={approval.requestedBy} />
              <Row label="Raised" value={formatDate(approval.requestedAt, 'long')} />
              <Row
                label="Deadline"
                value={
                  approval.status === 'pending' ? (
                    <ExpiryCountdown expiresAt={approval.expiresAt} />
                  ) : (
                    formatDate(approval.expiresAt, 'long')
                  )
                }
              />
              {approval.decidedBy ? <Row label="Decided by" value={approval.decidedBy} /> : null}
              {approval.decidedAt ? (
                <Row label="Decided" value={formatDate(approval.decidedAt, 'long')} />
              ) : null}
              {approval.reason ? <Row label="Decision reason" value={approval.reason} /> : null}
            </dl>
          </CardBody>
        </Card>

        <DecisionSection approval={approval} isSelf={isSelf} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="What changes" description="The payload the action will execute with" />
        <PayloadView payload={approval.payload} />
      </Card>
    </>
  );
}
