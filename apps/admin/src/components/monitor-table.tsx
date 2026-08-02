import type { MonitorEntry } from '@icb/contracts';
import { Amount, StatusBadge, formatTime } from '@icb/ui';

/** Compact monitor table for the operations dashboard. The full view lives at /monitor. */
export function MonitorTable({ entries }: Readonly<{ entries: MonitorEntry[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <caption className="sr-only">Recent ledger transactions</caption>
        <thead>
          <tr className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            <th scope="col" className="px-5 py-2 font-medium">Reference</th>
            <th scope="col" className="px-3 py-2 font-medium">Type</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--icb-border)]">
          {entries.map((entry) => (
            <tr key={entry.transactionId} className="hover:bg-[var(--icb-bg-subtle)]">
              <td className="px-5 py-2.5 font-mono text-xs">{entry.reference}</td>
              <td className="px-3 py-2.5 text-xs capitalize">{entry.type.replaceAll('_', ' ')}</td>
              <td className="px-3 py-2.5">
                <StatusBadge status={entry.status} />
              </td>
              <td className="px-3 py-2.5 text-right">
                <Amount value={entry.amount} size="sm" />
              </td>
              <td className="px-5 py-2.5 text-right font-mono text-xs text-[var(--icb-text-subtle)]">
                {formatTime(entry.at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
