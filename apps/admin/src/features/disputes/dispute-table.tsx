import type { Dispute } from '@icb/contracts';
import { Amount, Card, StatusBadge, formatDate } from '@icb/ui';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function isDisputeOverdue(dispute: Dispute): boolean {
  return new Date(dispute.slaDueAt).getTime() < Date.now() && dispute.resolvedAt === null;
}

/** The dispute queue table: stage, outcome and SLA pressure visible without opening the case. */
export function DisputeTable({ items }: Readonly<{ items: readonly Dispute[] }>) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Disputes by stage, tightest deadline first</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">Dispute</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Reason</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Stage</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Outcome</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">SLA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {items.map((dispute) => (
              <tr key={dispute.id} className="hover:bg-[var(--icb-bg-subtle)]">
                <td className="px-5 py-3">
                  <Link href={`/disputes/${dispute.id}`} className="font-medium hover:underline">
                    {dispute.customerName}
                  </Link>
                  <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                    {dispute.reference}
                  </p>
                </td>
                <td className="px-3 py-3 text-xs capitalize">
                  {dispute.reason.replaceAll('_', ' ')}
                </td>
                <td className="px-3 py-3 text-right">
                  <Amount value={dispute.amount} size="sm" />
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={dispute.stage} />
                </td>
                <td className="px-3 py-3">
                  {dispute.outcome ? (
                    <StatusBadge status={dispute.outcome} />
                  ) : (
                    <span className="text-xs text-[var(--icb-text-subtle)]">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-xs">
                  {isDisputeOverdue(dispute) ? (
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--icb-danger-fg)]">
                      <AlertTriangle size={13} />
                      Overdue
                    </span>
                  ) : (
                    <span className="text-[var(--icb-text-subtle)]">
                      {formatDate(dispute.slaDueAt, 'medium')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
