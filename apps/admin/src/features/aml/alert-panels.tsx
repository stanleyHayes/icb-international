import type { AmlAlert } from '@icb/contracts';
import { Card, CardBody, CardHeader, formatDate, formatTime } from '@icb/ui';
import { FileCheck } from 'lucide-react';

/** What matched, how strongly, and who owns the case. */
export function MatchDetailCard({ alert }: Readonly<{ alert: AmlAlert }>) {
  return (
    <Card>
      <CardHeader
        title="Match detail"
        description={
          alert.matchScore === null
            ? 'Why this alert was raised.'
            : `Match confidence ${Math.round(alert.matchScore * 100)}%.`
        }
      />
      <CardBody className="space-y-4 pt-0 text-sm">
        <p>{alert.matchDetail}</p>
        <dl className="space-y-3 border-t border-[var(--icb-border)] pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--icb-text-subtle)]">Assigned to</dt>
            <dd>{alert.assignedTo ?? 'Unassigned'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[var(--icb-text-subtle)]">Raised</dt>
            <dd>
              {formatDate(alert.createdAt, 'medium')} {formatTime(alert.createdAt)}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

/** The transactions behind a monitoring alert, or a note that this was a screening hit. */
export function RelatedTransactionsCard({ alert }: Readonly<{ alert: AmlAlert }>) {
  return (
    <Card>
      <CardHeader
        title="Related transactions"
        description={`${alert.relatedTransactionIds.length} linked`}
      />
      <CardBody className="pt-0">
        {alert.relatedTransactionIds.length > 0 ? (
          <ul className="space-y-1.5">
            {alert.relatedTransactionIds.map((transactionId) => (
              <li key={transactionId} className="font-mono text-xs">
                {transactionId}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--icb-text-muted)]">
            This is a screening hit, not a transaction-monitoring alert.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** The analyst's running narrative, as it currently stands. */
export function NarrativeCard({ narrative }: Readonly<{ narrative: string | null }>) {
  return (
    <Card>
      <CardHeader title="Narrative" description="The analyst's running account of the case." />
      <CardBody className="pt-0 text-sm">
        {narrative ? (
          <p className="whitespace-pre-wrap">{narrative}</p>
        ) : (
          <p className="text-[var(--icb-text-muted)]">
            No narrative yet — start one in the case workflow.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** The SAR/CTR filing on record. */
export function FiledReportView({ report }: Readonly<{ report: NonNullable<AmlAlert['filedReport']> }>) {
  return (
    <dl className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <FileCheck size={16} className="text-[var(--icb-success)]" aria-label="Filed" />
        <dd className="font-medium uppercase">{report.kind}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-[var(--icb-text-subtle)]">Reference</dt>
        <dd className="font-mono text-xs">{report.reference}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-[var(--icb-text-subtle)]">Filed</dt>
        <dd>
          {formatDate(report.filedAt, 'medium')} {formatTime(report.filedAt)}
        </dd>
      </div>
      {report.asset ? (
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[var(--icb-text-subtle)]">Document</dt>
          <dd className="font-mono text-xs">{report.asset.publicId}</dd>
        </div>
      ) : null}
    </dl>
  );
}
