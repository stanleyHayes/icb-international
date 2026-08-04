import type { LoanDetail } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { LoanActions } from '@/features/loans/loan-actions';
import { LOAN_PATHS } from '@/features/loans/loans.constants';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Loan' };

type Params = Promise<{ loanId: string }>;

/**
 * One loan.
 *
 * The schedule is never summarised away: collections and restructure decisions rest on exactly
 * which instalments were missed, so the full amortisation table stays visible alongside the
 * actions that change it.
 */
export default async function LoanDetailPage({ params }: Readonly<{ params: Params }>) {
  const { loanId } = await params;
  const loan = await api<LoanDetail>(LOAN_PATHS.loan(loanId));

  return (
    <>
      <Link
        href="/loans?view=collections"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Lending
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{loan.reference}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <StatusBadge status={loan.status} />
            <span>{loan.productName}</span>
            <span className="tabular">{loan.rate}%</span>
          </p>
        </div>
        <LoanActions
          loanId={loan.id}
          canDisburse={loan.status === 'approved'}
          canRestructure={loan.status === 'active' || loan.status === 'in_arrears'}
          canWriteOff={loan.status === 'in_arrears'}
        />
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <ScheduleCard loan={loan} />

        <div className="space-y-6">
          {loan.arrears ? <ArrearsCard loan={loan} /> : null}
          <Card>
            <CardHeader title="Position" />
            <CardBody className="pt-0">
              <dl className="space-y-3 text-sm">
                <MoneyRow label="Principal" value={loan.principal} />
                <MoneyRow label="Outstanding principal" value={loan.outstandingPrincipal} />
                <MoneyRow label="Outstanding interest" value={loan.outstandingInterest} />
                <MoneyRow label="Total outstanding" value={loan.totalOutstanding} />
                <MoneyRow label="Instalment" value={loan.instalment} />
                <TextRow
                  label="Progress"
                  value={`${loan.paidInstalments} of ${loan.paidInstalments + loan.remainingInstalments} paid`}
                />
                <TextRow
                  label="Next payment"
                  value={loan.nextPaymentOn ? formatDate(loan.nextPaymentOn, 'medium') : '—'}
                />
                <TextRow label="Matures" value={formatDate(loan.maturesOn, 'medium')} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function ScheduleCard({ loan }: Readonly<{ loan: LoanDetail }>) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Schedule"
        description={`${loan.schedule.length} instalments · ${loan.frequency}`}
      />
      <div className="max-h-[560px] overflow-x-auto overflow-y-auto">
        <table className="w-full min-w-[620px] text-sm">
          <caption className="sr-only">Amortisation schedule</caption>
          <thead className="sticky top-0">
            <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
              <th scope="col" className="px-5 py-2.5 font-medium">#</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Instalment</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Principal</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Interest</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--icb-border)]">
            {loan.schedule.map((row) => (
              <tr key={row.number} className="hover:bg-[var(--icb-bg-subtle)]">
                <td className="px-5 py-2.5 text-xs tabular text-[var(--icb-text-subtle)]">
                  {row.number}
                </td>
                <td className="px-3 py-2.5 text-xs">{formatDate(row.dueOn, 'medium')}</td>
                <td className="px-3 py-2.5 text-right">
                  <Amount value={row.instalment} size="sm" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Amount value={row.principal} size="sm" />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Amount value={row.interest} size="sm" />
                </td>
                <td className="px-5 py-2.5 text-right">
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

function ArrearsCard({ loan }: Readonly<{ loan: LoanDetail }>) {
  const arrears = loan.arrears;
  if (!arrears) return null;
  return (
    <Card>
      <CardHeader title="Arrears" description="Collections posture for this loan." />
      <CardBody className="pt-0">
        <p className="flex items-center gap-2 text-sm font-medium text-[var(--icb-danger-fg)]">
          <AlertTriangle size={15} />
          {arrears.daysPastDue} days past due · {arrears.missedInstalments} missed
        </p>
        <div className="mt-3 flex items-baseline justify-between gap-4 text-sm">
          <span className="text-[var(--icb-text-subtle)]">Arrears amount</span>
          <Amount value={arrears.amount} size="sm" direction="debit" />
        </div>
      </CardBody>
    </Card>
  );
}

function MoneyRow({ label, value }: Readonly<{ label: string; value: LoanDetail['principal'] }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd>
        <Amount value={value} size="sm" />
      </dd>
    </div>
  );
}

function TextRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
