import type { BreakDepositQuote, TermDeposit } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { BreakDepositButton } from '@/features/savings/break-deposit';
import { api } from '@/lib/api';

type Params = Promise<{ depositId: string }>;

export const metadata: Metadata = { title: 'Fixed deposit' };

const INSTRUCTION_LABELS: Readonly<Record<string, string>> = {
  rollover_principal: 'Reinvest the principal, pay out the interest',
  rollover_all: 'Reinvest principal and interest',
  transfer_out: 'Paid out to your account',
};

/**
 * One term deposit: what it will be worth, what it has earned so far, and — quoted up front —
 * what breaking it early would cost.
 */
export default async function DepositDetailPage({ params }: Readonly<{ params: Params }>) {
  const { depositId } = await params;
  const deposit = await api<TermDeposit>(`/savings/deposits/${depositId}`, { tags: ['savings'] });
  const breakQuote =
    deposit.status === 'active'
      ? await api<BreakDepositQuote>(`/savings/deposits/${depositId}/break-quote`, {
          tags: ['savings'],
        }).catch(() => null)
      : null;

  return (
    <>
      <Link
        href="/savings"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Savings
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
            {deposit.termMonths}-month deposit at {deposit.rate}%
          </h1>
          <p className="mt-1.5 font-mono text-xs text-[var(--icb-text-subtle)]">
            {deposit.reference}
          </p>
        </div>
        <StatusBadge status={deposit.status} />
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Principal" value={<Amount value={deposit.principal} size="lg" />} />
        <Stat
          label="Interest so far"
          value={<Amount value={deposit.accruedInterest} size="lg" />}
        />
        <Stat
          label="Value at maturity"
          value={<Amount value={deposit.maturityValue} size="lg" />}
          note={`Matures ${formatDate(deposit.maturesOn, 'medium')}`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader title="At maturity" />
        <CardBody className="pt-0">
          <p className="text-sm">{INSTRUCTION_LABELS[deposit.maturityInstruction]}</p>
          <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
            Opened {formatDate(deposit.openedOn, 'medium')} · projected interest{' '}
            <Amount value={deposit.projectedInterest} size="sm" />
          </p>
        </CardBody>
      </Card>

      {breakQuote ? (
        <Card className="mt-6">
          <CardHeader
            title="Break this deposit early"
            description="The cost, quoted before you decide. The quote holds until the time shown."
          />
          <CardBody className="pt-0">
            <dl className="space-y-2.5 text-sm">
              <Row label="Principal back">
                <Amount value={breakQuote.principal} size="sm" />
              </Row>
              <Row label="Interest kept">
                <Amount value={breakQuote.accruedInterest} size="sm" />
              </Row>
              <Row label="Penalty">
                <span className="text-[var(--icb-danger-fg)]">
                  −<Amount value={breakQuote.penalty} size="sm" />
                </span>
              </Row>
              <div className="flex items-baseline justify-between gap-4 border-t border-[var(--icb-border)] pt-2.5">
                <dt className="font-medium">You would receive</dt>
                <dd>
                  <Amount value={breakQuote.netProceeds} size="lg" />
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
              <Amount value={breakQuote.interestForfeited} size="sm" /> of earned interest would be
              forfeited. Quote valid until {formatDate(breakQuote.validUntil, 'medium')}.
            </p>
            <div className="mt-4">
              <BreakDepositButton depositId={deposit.id} />
            </div>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

function Stat({
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

function Row({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--icb-text-subtle)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
