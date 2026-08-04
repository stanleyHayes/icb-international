import type { AccountSummary, LoanDetail, PayoffQuote } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RepayForm } from '@/features/loans/loan-forms';
import { api } from '@/lib/api';

type Params = Promise<{ loanId: string }>;

export const metadata: Metadata = { title: 'Loan' };

/**
 * An active loan: what is owed, what is next, the full schedule, and the price of walking away
 * early — quoted, never discovered after the fact.
 */
export default async function LoanDetailPage({ params }: Readonly<{ params: Params }>) {
  const { loanId } = await params;
  const [loan, payoff, accounts] = await Promise.all([
    api<LoanDetail>(`/loans/${loanId}`, { tags: ['loans'] }),
    api<PayoffQuote>(`/loans/${loanId}/payoff-quote`, { tags: ['loans'] }).catch(() => null),
    api<AccountSummary[]>('/accounts', { tags: ['accounts'] }),
  ]);
  const active = accounts.filter((account) => account.status === 'active');
  const open = loan.status === 'active' || loan.status === 'in_arrears';

  return (
    <>
      <Link
        href="/loans"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Loans
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
            {loan.productName}
          </h1>
          <p className="mt-1.5 font-mono text-xs text-[var(--icb-text-subtle)]">{loan.reference}</p>
        </div>
        <StatusBadge status={loan.arrears ? 'in_arrears' : loan.status} />
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={<Amount value={loan.totalOutstanding} size="lg" />} />
        <StatCard
          label="Next payment"
          value={
            loan.nextPaymentAmount ? (
              <Amount value={loan.nextPaymentAmount} size="lg" />
            ) : (
              <span className="text-lg font-semibold">None due</span>
            )
          }
          note={loan.nextPaymentOn ? formatDate(loan.nextPaymentOn, 'medium') : undefined}
        />
        <StatCard
          label="Rate"
          value={<span className="tabular text-lg font-semibold">{loan.rate}%</span>}
          note={`${loan.remainingInstalments} payments left`}
        />
      </div>

      {loan.arrears ? (
        <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--icb-warning-border)] bg-[var(--icb-warning-bg)] px-4 py-3 text-sm text-[var(--icb-warning-fg)]">
          <Amount value={loan.arrears.amount} size="sm" /> overdue by {loan.arrears.daysPastDue}{' '}
          days across {loan.arrears.missedInstalments} missed payment
          {loan.arrears.missedInstalments === 1 ? '' : 's'}.
        </p>
      ) : null}

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        {open ? (
          <Card>
            <CardHeader title="Make a payment" description="Scheduled, extra, or settle in full." />
            <CardBody className="pt-0">
              <RepayForm loan={loan} accounts={active} />
            </CardBody>
          </Card>
        ) : null}

        {payoff ? <PayoffPanel payoff={payoff} /> : null}
      </div>

      <SchedulePanel loan={loan} />
    </>
  );
}

function StatCard({
  label,
  value,
  note,
}: Readonly<{ label: string; value: React.ReactNode; note?: string | undefined }>) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="text-xs text-[var(--icb-text-subtle)]">{label}</p>
        <p className="mt-1.5">{value}</p>
        {note ? <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">{note}</p> : null}
      </CardBody>
    </Card>
  );
}

function PayoffPanel({ payoff }: Readonly<{ payoff: PayoffQuote }>) {
  return (
    <Card>
      <CardHeader
        title="Payoff quote"
        description={`What settling today costs. Valid until ${formatDate(payoff.validUntil, 'medium')}.`}
      />
      <CardBody className="pt-0">
        <dl className="space-y-2.5 text-sm">
          <Row label="Principal">
            <Amount value={payoff.outstandingPrincipal} size="sm" />
          </Row>
          <Row label="Accrued interest">
            <Amount value={payoff.accruedInterest} size="sm" />
          </Row>
          <Row label="Early repayment fee">
            <Amount value={payoff.earlyRepaymentFee} size="sm" />
          </Row>
          <div className="flex items-baseline justify-between gap-4 border-t border-[var(--icb-border)] pt-2.5">
            <dt className="font-medium">Total to settle</dt>
            <dd>
              <Amount value={payoff.totalPayoff} size="lg" />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[var(--icb-success-fg)]">
          Settling now saves <Amount value={payoff.savingsVersusTerm} size="sm" /> against running
          to term.
        </p>
      </CardBody>
    </Card>
  );
}

function SchedulePanel({ loan }: Readonly<{ loan: LoanDetail }>) {
  return (
    <Card className="mt-8 overflow-hidden">
      <CardHeader title="Repayment schedule" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--icb-border)] text-left text-xs text-[var(--icb-text-subtle)]">
              <th scope="col" className="px-5 py-3 font-medium">#</th>
              <th scope="col" className="px-5 py-3 font-medium">Due</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Instalment</th>
              <th scope="col" className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                Principal
              </th>
              <th scope="col" className="hidden px-5 py-3 text-right font-medium sm:table-cell">
                Interest
              </th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Balance</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {loan.schedule.map((row) => (
              <tr key={row.number}>
                <td className="tabular px-5 py-3 text-[var(--icb-text-subtle)]">{row.number}</td>
                <td className="px-5 py-3">{formatDate(row.dueOn, 'medium')}</td>
                <td className="px-5 py-3 text-right">
                  <Amount value={row.instalment} size="sm" />
                </td>
                <td className="hidden px-5 py-3 text-right sm:table-cell">
                  <Amount value={row.principal} size="sm" />
                </td>
                <td className="hidden px-5 py-3 text-right sm:table-cell">
                  <Amount value={row.interest} size="sm" />
                </td>
                <td className="px-5 py-3 text-right">
                  <Amount value={row.closingBalance} size="sm" />
                </td>
                <td className="px-5 py-3 text-right">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
