import type { TrialBalance } from '@icb/contracts';
import { Amount, Card, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Trial balance' };

export default async function LedgerPage() {
  const trial = await api<TrialBalance>('/admin/trial-balance');

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Trial balance</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Built from ledger entries, not cached balances — so drift shows up here first.
        </p>
      </header>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          title={`General ledger · ${trial.currency}`}
          description={trial.balanced ? 'Debits equal credits' : 'OUT OF BALANCE'}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Trial balance by general-ledger account</caption>
            <thead>
              <tr className="border-y border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="px-5 py-2 font-medium">Code</th>
                <th scope="col" className="px-3 py-2 font-medium">Account</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Debit</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Credit</th>
                <th scope="col" className="px-5 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {trial.lines.map((line) => (
                <tr key={line.accountCode} className="hover:bg-[var(--icb-bg-subtle)]">
                  <td className="px-5 py-2.5 font-mono text-xs">{line.accountCode}</td>
                  <td className="px-3 py-2.5">{line.accountName}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--icb-text-subtle)] capitalize">
                    {line.type}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Amount value={line.debit} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Amount value={line.credit} size="sm" />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <Amount value={line.balance} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--icb-border-strong)] font-semibold">
                <td className="px-5 py-3" colSpan={3}>
                  Totals
                </td>
                <td className="px-3 py-3 text-right">
                  <Amount value={trial.totalDebits} size="sm" />
                </td>
                <td className="px-3 py-3 text-right">
                  <Amount value={trial.totalCredits} size="sm" />
                </td>
                <td className="px-5 py-3 text-right text-xs">
                  {trial.balanced ? 'Balanced' : 'OUT OF BALANCE'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}
