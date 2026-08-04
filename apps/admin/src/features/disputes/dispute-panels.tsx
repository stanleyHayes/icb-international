import type { Dispute } from '@icb/contracts';
import {
  Amount,
  Card,
  CardBody,
  CardHeader,
  formatDate,
  formatFileSize,
  formatTime,
} from '@icb/ui';
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';

/** What the customer says happened, and the identifiers the case hangs off. */
export function ClaimCard({ dispute }: Readonly<{ dispute: Dispute }>) {
  return (
    <Card>
      <CardHeader title="The claim" description="What the customer says happened." />
      <CardBody className="space-y-4 pt-0 text-sm">
        <p>{dispute.detail}</p>
        <dl className="space-y-3 border-t border-[var(--icb-border)] pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--icb-text-subtle)]">Transaction</dt>
            <dd className="font-mono text-xs">{dispute.transactionId}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--icb-text-subtle)]">Opened</dt>
            <dd>
              {formatDate(dispute.createdAt, 'medium')} {formatTime(dispute.createdAt)}
            </dd>
          </div>
          {dispute.resolvedAt ? (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--icb-text-subtle)]">Resolved</dt>
              <dd>
                {formatDate(dispute.resolvedAt, 'medium')} {formatTime(dispute.resolvedAt)}
              </dd>
            </div>
          ) : null}
        </dl>
      </CardBody>
    </Card>
  );
}

function EvidenceIcon({ resourceType }: Readonly<{ resourceType: 'image' | 'raw' | 'video' }>) {
  const className = 'mt-0.5 shrink-0 text-[var(--icb-text-subtle)]';
  if (resourceType === 'image') {
    return <ImageIcon size={17} className={className} aria-label="Image evidence" />;
  }
  if (resourceType === 'video') {
    return <Paperclip size={17} className={className} aria-label="Video evidence" />;
  }
  return <FileText size={17} className={className} aria-label="Document evidence" />;
}

/** Everything uploaded in support of or against the claim, with provenance. */
export function EvidenceList({ evidence }: Readonly<{ evidence: Dispute['evidence'] }>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Evidence"
        description={`${evidence.length} item${evidence.length === 1 ? '' : 's'} on file`}
      />
      {evidence.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {evidence.map((item) => (
            <li key={item.id} className="flex items-start gap-3 px-5 py-3.5">
              <EvidenceIcon resourceType={item.asset.resourceType} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                  {item.asset.originalFilename ?? item.asset.publicId}
                  {item.asset.bytes === undefined ? '' : ` · ${formatFileSize(item.asset.bytes)}`}
                  {' · '}
                  {formatDate(item.uploadedAt, 'medium')}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--icb-bg-muted)] px-2 py-0.5 text-xs font-medium capitalize">
                {item.uploadedBy}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <CardBody className="pt-0 text-sm text-[var(--icb-text-muted)]">
          No evidence has been uploaded yet.
        </CardBody>
      )}
    </Card>
  );
}

/** Provisional credit and the ledger posting behind it. */
export function CreditSummary({ dispute }: Readonly<{ dispute: Dispute }>) {
  const credit = dispute.provisionalCredit;

  return (
    <Card>
      <CardHeader
        title="Credit &amp; posting"
        description="Provisional credit and the ledger postings behind it."
      />
      <CardBody className="pt-0">
        {credit ? (
          <dl className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--icb-text-subtle)]">Credit granted</dt>
              <dd>
                <Amount value={credit.amount} size="sm" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--icb-text-subtle)]">Granted</dt>
              <dd>{formatDate(credit.grantedAt, 'medium')}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--icb-text-subtle)]">Posting</dt>
              <dd className="font-mono text-xs">{credit.transactionId}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--icb-text-subtle)]">Clawed back</dt>
              <dd>{credit.clawedBackAt ? formatDate(credit.clawedBackAt, 'medium') : 'No'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[var(--icb-text-muted)]">
            No provisional credit has been granted on this dispute.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
