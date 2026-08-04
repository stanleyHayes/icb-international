import type { Dispute } from '@icb/contracts';
import {
  Amount,
  Card,
  CardBody,
  CardHeader,
  StatusBadge,
  Timeline,
  formatDate,
  type TimelineItem,
} from '@icb/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { AdvanceForm } from '@/features/disputes/advance-form';
import { ClaimCard, CreditSummary, EvidenceList } from '@/features/disputes/dispute-panels';
import { isDisputeOverdue } from '@/features/disputes/dispute-table';
import { api } from '@/lib/api';

type Params = Promise<{ disputeId: string }>;

export const metadata: Metadata = { title: 'Dispute' };

function toTimelineItems(dispute: Dispute): TimelineItem[] {
  return dispute.timeline.map((entry, index) => ({
    id: `${entry.at}-${index}`,
    title: entry.stage.replaceAll('_', ' '),
    description: entry.note,
    timestamp: entry.at,
    tone: entry.stage === 'resolved' ? 'success' : 'default',
  }));
}

/**
 * One dispute: the claim and its evidence on the left, credit and stage control on the right.
 */
export default async function DisputeDetailPage({ params }: Readonly<{ params: Params }>) {
  const { disputeId } = await params;
  const dispute = await api<Dispute>(`/disputes/admin/${disputeId}`);
  const resolved = dispute.stage === 'resolved';
  const overdue = isDisputeOverdue(dispute);

  return (
    <>
      <Link
        href="/disputes"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Disputes
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            {dispute.customerName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={dispute.stage} />
            {dispute.outcome ? <StatusBadge status={dispute.outcome} /> : null}
            <span className="capitalize">{dispute.reason.replaceAll('_', ' ')}</span>
            <span className="font-mono text-xs">{dispute.reference}</span>
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--icb-text-subtle)]">Disputed amount</p>
          <Amount value={dispute.amount} size="xl" />
          <p
            className={
              overdue
                ? 'mt-1 flex items-center justify-end gap-1 text-xs font-medium text-[var(--icb-danger-fg)]'
                : 'mt-1 text-xs text-[var(--icb-text-subtle)]'
            }
          >
            {overdue ? <AlertTriangle size={12} /> : null}
            SLA {formatDate(dispute.slaDueAt, 'medium')}
          </p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <ClaimCard dispute={dispute} />
          <EvidenceList evidence={dispute.evidence} />
          <Card>
            <CardHeader title="Timeline" description="Every stage move, in order." />
            <CardBody className="pt-0">
              <Timeline items={toTimelineItems(dispute)} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <CreditSummary dispute={dispute} />
          <Card>
            <CardHeader
              title={resolved ? 'Resolved' : 'Advance stage'}
              description={
                resolved
                  ? 'This dispute is closed.'
                  : 'Move the dispute forward; credit and outcome post automatically.'
              }
            />
            <CardBody className="pt-0">
              {resolved ? (
                <p className="text-sm text-[var(--icb-text-muted)]">
                  Outcome:{' '}
                  <span className="font-medium capitalize">{dispute.outcome ?? 'recorded'}</span>.
                  Any credit above shows whether it stands or was clawed back.
                </p>
              ) : (
                <AdvanceForm
                  disputeId={dispute.id}
                  currentStage={dispute.stage}
                  hasProvisionalCredit={dispute.provisionalCredit !== null}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
