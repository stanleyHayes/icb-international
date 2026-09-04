import type { AccountSummary, CursorPage, DepositRateBand } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { DepositForm } from '@/features/savings/deposit-form';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Open a fixed deposit' };

/** The published term/rate matrix, then the form that locks a rate in. */
export default async function NewDepositPage() {
  const [rates, accountsPage] = await Promise.all([
    api<{ items: DepositRateBand[] }>('/savings/rates', { tags: ['savings'], revalidate: 300 }),
    api<CursorPage<AccountSummary>>('/accounts?limit=50', { tags: ['accounts'] }),
  ]);
  const active = accountsPage.items.filter((account) => account.status === 'active');
  const bands = [...rates.items].sort((a, b) => a.termMonths - b.termMonths);

  return (
    <>
      <Link
        href="/savings"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Savings
      </Link>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader
            title="Open a fixed deposit"
            description="Pick a term from the rate card, fund it, and the rate is locked for the whole term."
          />
          <CardBody className="pt-0">
            <DepositForm bands={bands} accounts={active} />
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Rate card" description="Annual rate by term." />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--icb-border)] text-left text-xs text-[var(--icb-text-subtle)]">
                <th scope="col" className="px-5 py-3 font-medium">Term</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Rate</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Minimum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {bands.map((band) => (
                <tr key={band.termMonths}>
                  <td className="px-5 py-3">
                    {band.termMonths} month{band.termMonths === 1 ? '' : 's'}
                  </td>
                  <td className="tabular px-5 py-3 text-right font-semibold text-[var(--icb-primary)]">
                    {band.rate}%
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Amount value={band.minimumAmount} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
