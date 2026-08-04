import type { RiskCase } from '@icb/contracts';
import { Amount, Card, StatusBadge, formatDate } from '@icb/ui';
import Link from 'next/link';

import { SeverityBadge } from './severity-badge';

/** The fraud queue table: one row per case, score and exposure visible without opening it. */
export function CaseTable({ items }: Readonly<{ items: readonly RiskCase[] }>) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <caption className="sr-only">Fraud cases awaiting review</caption>
          <thead>
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">Case</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Severity</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Score</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Decision</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">At risk</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Opened</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {items.map((riskCase) => (
              <tr key={riskCase.id} className="hover:bg-[var(--icb-bg-subtle)]">
                <td className="px-5 py-3">
                  <Link href={`/fraud/${riskCase.id}`} className="font-medium hover:underline">
                    {riskCase.customerName}
                  </Link>
                  <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                    {riskCase.reference}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <SeverityBadge severity={riskCase.severity} />
                </td>
                <td className="tabular px-3 py-3 text-sm font-semibold">
                  {riskCase.assessment.score}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={riskCase.assessment.decision} />
                </td>
                <td className="px-3 py-3 text-right">
                  {riskCase.amountAtRisk ? (
                    <Amount value={riskCase.amountAtRisk} size="sm" />
                  ) : (
                    <span className="text-xs text-[var(--icb-text-subtle)]">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={riskCase.status} />
                </td>
                <td className="px-5 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                  {formatDate(riskCase.createdAt, 'medium')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
