import type { AmlAlert } from '@icb/contracts';
import { Amount, Card, StatusBadge, formatDate } from '@icb/ui';
import Link from 'next/link';

import { SeverityBadge } from '@/features/fraud/severity-badge';

/** The AML queue table: kind, confidence and aggregate visible without opening the alert. */
export function AlertTable({ items }: Readonly<{ items: readonly AmlAlert[] }>) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">AML alerts awaiting review</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">Alert</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Kind</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Severity</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Match</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Aggregate</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Raised</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {items.map((alert) => (
              <tr key={alert.id} className="hover:bg-[var(--icb-bg-subtle)]">
                <td className="px-5 py-3">
                  <Link href={`/aml/${alert.id}`} className="font-medium hover:underline">
                    {alert.customerName}
                  </Link>
                  <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                    {alert.reference}
                  </p>
                </td>
                <td className="px-3 py-3 text-xs capitalize">{alert.kind.replaceAll('_', ' ')}</td>
                <td className="px-3 py-3">
                  <SeverityBadge severity={alert.severity} />
                </td>
                <td className="tabular px-3 py-3 text-xs">
                  {alert.matchScore === null ? '—' : `${Math.round(alert.matchScore * 100)}%`}
                </td>
                <td className="px-3 py-3 text-right">
                  {alert.aggregateAmount ? (
                    <Amount value={alert.aggregateAmount} size="sm" />
                  ) : (
                    <span className="text-xs text-[var(--icb-text-subtle)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={alert.status} />
                </td>
                <td className="px-5 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                  {formatDate(alert.createdAt, 'medium')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
