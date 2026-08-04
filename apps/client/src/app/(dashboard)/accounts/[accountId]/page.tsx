import type { AccountDetail, AccountSummary, CursorPage, TransactionSummary } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft, ArrowLeftRight, Receipt } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { TransactionList } from '@/components/transaction-list';
import { AccountActions } from '@/features/accounts/account-actions';
import { AccountDetailsSheet } from '@/features/accounts/account-details-sheet';
import { BalanceHistoryCard } from '@/features/accounts/balance-history-card';
import { NicknameEditor } from '@/features/accounts/nickname-editor';
import { StandingOrdersCard } from '@/features/accounts/standing-orders-card';
import { StatementsCard } from '@/features/accounts/statements-card';
import { api } from '@/lib/api';

type Params = Promise<{ accountId: string }>;

export async function generateMetadata({
  params,
}: Readonly<{ params: Params }>): Promise<Metadata> {
  const { accountId } = await params;
  const account = await api<AccountDetail>(`/accounts/${accountId}`, { tags: ['accounts'] });
  return { title: account.nickname ?? account.productName };
}

/**
 * One account in full.
 *
 * Ledger, holds and available are shown together rather than collapsed into a single figure —
 * a customer who sees only one of the three is the customer who gets declined at a till.
 */
export default async function AccountDetailPage({ params }: Readonly<{ params: Params }>) {
  const { accountId } = await params;

  const [account, accountsResponse, transactions] = await Promise.all([
    api<AccountDetail>(`/accounts/${accountId}`, { tags: ['accounts'] }),
    api<{ items: AccountSummary[] }>('/accounts', { tags: ['accounts'] }),
    api<CursorPage<TransactionSummary>>(`/transactions?accountId=${accountId}&limit=25`, {
      tags: ['transactions'],
    }),
  ]);

  const sweepCandidates = accountsResponse.items.filter(
    (candidate) => candidate.id !== account.id && candidate.status === 'active',
  );

  return (
    <>
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        All accounts
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-1 font-display text-3xl font-bold tracking-[-0.02em]">
            {account.nickname ?? account.productName}
            <NicknameEditor
              accountId={account.id}
              currentNickname={account.nickname}
              fallbackName={account.productName}
            />
          </h1>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            {account.productName}
            <StatusBadge status={account.status} />
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AccountDetailsSheet account={account} />
          <Link
            href={`/transfer?from=${account.id}`}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
          >
            <ArrowLeftRight size={16} />
            Transfer
          </Link>
        </div>
      </header>

      <section aria-labelledby="balances" className="mt-8">
        <h2 id="balances" className="sr-only">
          Balances
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <BalanceTile label="Ledger balance" hint="Everything that has posted" value={account.balances.ledger} />
          <BalanceTile label="On hold" hint="Authorised, not yet posted" value={account.balances.holds} />
          <BalanceTile
            label="Available"
            hint="Ledger − holds + overdraft"
            value={account.balances.available}
            emphasis
          />
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <BalanceHistoryCard accountId={account.id} />
        <TermsCard account={account} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Activity"
            action={
              <Link
                href={`/transactions?account=${account.id}`}
                className="text-sm font-medium text-[var(--icb-primary)] hover:underline"
              >
                All transactions
              </Link>
            }
          />
          {transactions.items.length > 0 ? (
            <TransactionList transactions={transactions.items} />
          ) : (
            <EmptyState
              icon={<Receipt size={20} />}
              title="No activity yet"
              description="Transactions on this account will appear here."
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Manage account" />
          <CardBody className="pt-0">
            <AccountActions account={account} sweepCandidates={sweepCandidates} />
            <p className="mt-3 text-xs text-[var(--icb-text-subtle)]">
              Freezing pauses all movement on the account while it is reviewed. Closing is
              permanent.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <StatementsCard accountId={account.id} />
        <StandingOrdersCard accountId={account.id} />
      </div>
    </>
  );
}

/** Rates, overdraft and statement cadence — the terms that explain the numbers. */
function TermsCard({ account }: Readonly<{ account: AccountDetail }>) {
  return (
    <Card>
      <CardHeader title="Terms" />
      <CardBody className="pt-0">
        <dl className="space-y-3 text-sm">
          <DetailRow
            label="Interest rate"
            value={account.interestRate === null ? '—' : `${account.interestRate}% AER`}
          />
          <DetailRow
            label="Arranged overdraft"
            value={
              account.balances.overdraftLimit.minorUnits === 0 ? (
                'None'
              ) : (
                <Amount value={account.balances.overdraftLimit} size="sm" />
              )
            }
          />
          <DetailRow label="Statement day" value={`${account.statementDay} of the month`} />
          <DetailRow label="Opened" value={formatDate(account.openedAt, 'medium')} />
        </dl>
      </CardBody>
    </Card>
  );
}

function BalanceTile({
  label,
  hint,
  value,
  emphasis = false,
}: Readonly<{
  label: string;
  hint: string;
  value: { minorUnits: number; currency: string; scale: number };
  emphasis?: boolean;
}>) {
  return (
    <Card className={emphasis ? 'border-[var(--icb-primary)]' : ''}>
      <CardBody className="pt-5">
        <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
          {label}
        </p>
        <p className="mt-2">
          <Amount value={value} size="xl" />
        </p>
        <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">{hint}</p>
      </CardBody>
    </Card>
  );
}

function DetailRow({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 font-sans text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right break-all">{value}</dd>
    </div>
  );
}
