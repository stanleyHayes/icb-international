import type { MonitorEntry } from '@icb/contracts';
import { Amount, Card, StatusBadge, formatDate, formatTime } from '@icb/ui';
import type { Metadata } from 'next';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Monitor' };

export default async function MonitorPage() {
  const { items } = await api<{ items: MonitorEntry[] }>('/admin/monitor');

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Transaction monitor</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Live flow across every account in the bank.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">All ledger transactions</caption>
            <thead>
              <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="px-5 py-2.5 font-medium">Reference</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Account</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Booked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {items.map((entry) => (
                <tr key={entry.transactionId} className="hover:bg-[var(--icb-bg-subtle)]">
                  <td className="px-5 py-2.5 font-mono text-xs">{entry.reference}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                    {entry.accountLabel}
                  </td>
                  <td className="px-3 py-2.5 text-xs capitalize">
                    {entry.type.replaceAll('_', ' ')}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Amount value={entry.amount} direction={entry.direction} size="sm" />
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-xs text-[var(--icb-text-subtle)]">
                    {formatDate(entry.at, 'short')} {formatTime(entry.at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
