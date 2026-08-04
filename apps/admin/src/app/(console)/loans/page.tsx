import type { CursorPage, Loan, LoanApplication } from '@icb/contracts';
import { Amount, Card, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { HandCoins, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LOAN_PATHS } from '@/features/loans/loans.constants';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Lending' };

type SearchParams = Promise<{ view?: string }>;

const BUCKET_LABELS: Readonly<Record<string, string>> = {
  current: 'Current',
  '1_29': '1–29 days',
  '30_59': '30–59 days',
  '60_89': '60–89 days',
  '90_plus': '90+ days',
};

/**
 * The lending desk.
 *
 * Two views, both ordered by urgency: the underwriting queue (what the scorecard would not
 * settle on its own) and the collections list (what has stopped paying). Everything in between
 * is running as agreed and does not need an operator.
 */
export default async function LoansPage({
  searchParams,
}: Readonly<{ searchParams: SearchParams }>) {
  const { view } = await searchParams;
  const collections = view === 'collections';

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Lending</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {collections
              ? 'Loans past due, oldest arrears first.'
              : 'Applications waiting on an underwriter.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/loans" className={tabClass(!collections)} aria-current={!collections ? 'page' : undefined}>
            Underwriting
          </Link>
          <Link
            href="/loans?view=collections"
            className={tabClass(collections)}
            aria-current={collections ? 'page' : undefined}
          >
            Collections
          </Link>
        </div>
      </header>

      <div className="mt-6">{collections ? <CollectionsList /> : <UnderwritingQueue />}</div>
    </>
  );
}

async function UnderwritingQueue() {
  const queue = await api<{ items: LoanApplication[] }>(LOAN_PATHS.queue);

  return (
    <Card className="overflow-hidden">
      {queue.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">Loan applications awaiting an underwriting decision</caption>
            <thead>
              <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="px-5 py-2.5 font-medium">Application</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Product</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Requested</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Scorecard</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {queue.items.map((application) => (
                <tr key={application.id} className="hover:bg-[var(--icb-bg-subtle)]">
                  <td className="px-5 py-3">
                    <Link
                      href={`/loans/applications/${application.id}`}
                      className="font-medium hover:underline"
                    >
                      {application.reference}
                    </Link>
                    <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                      {application.customerId.slice(0, 10)}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {application.productName}
                    <span className="block text-[var(--icb-text-subtle)]">
                      {application.termMonths} months · {application.frequency}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Amount value={application.requestedAmount} size="sm" />
                  </td>
                  <td className="px-3 py-3">
                    {application.decision ? (
                      <span className="inline-flex items-center gap-2">
                        <StatusBadge status={application.decision.outcome} />
                        <span className="text-xs tabular text-[var(--icb-text-subtle)]">
                          {application.decision.score}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--icb-text-subtle)]">Not assessed</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-[var(--icb-text-subtle)]">
                    {application.submittedAt ? formatDate(application.submittedAt, 'medium') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<ShieldCheck size={20} />}
          title="Queue is clear"
          description="No applications are waiting for an underwriting decision."
        />
      )}
    </Card>
  );
}

async function CollectionsList() {
  const page = await api<CursorPage<Loan>>(`${LOAN_PATHS.portfolio}?inArrearsOnly=true`);

  return (
    <Card className="overflow-hidden">
      {page.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">Loans in arrears</caption>
            <thead>
              <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                <th scope="col" className="px-5 py-2.5 font-medium">Loan</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Outstanding</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Arrears</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Bucket</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Missed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--icb-border)]">
              {page.items.map((loan) => (
                <tr key={loan.id} className="hover:bg-[var(--icb-bg-subtle)]">
                  <td className="px-5 py-3">
                    <Link href={`/loans/${loan.id}`} className="font-medium hover:underline">
                      {loan.reference}
                    </Link>
                    <p className="text-xs text-[var(--icb-text-subtle)]">{loan.productName}</p>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={loan.status} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Amount value={loan.totalOutstanding} size="sm" />
                  </td>
                  <td className="px-3 py-3 text-right">
                    {loan.arrears ? (
                      <Amount value={loan.arrears.amount} size="sm" direction="debit" />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {loan.arrears ? (BUCKET_LABELS[loan.arrears.bucket] ?? loan.arrears.bucket) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-xs tabular">
                    {loan.arrears?.missedInstalments ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={<HandCoins size={20} />}
          title="Nothing in collections"
          description="No loans are past due."
        />
      )}
    </Card>
  );
}

function tabClass(active: boolean): string {
  return active
    ? 'inline-flex h-9 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3.5 text-sm font-medium text-white'
    : 'inline-flex h-9 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3.5 text-sm font-medium transition-colors hover:bg-[var(--icb-bg-muted)]';
}
