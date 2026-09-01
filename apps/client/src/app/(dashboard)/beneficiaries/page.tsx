import type { Beneficiary, CursorPage } from '@icb/contracts';
import { Button, Card, Checkbox, EmptyState, Input, formatDate, formatTime } from '@icb/ui';
import { ArrowLeftRight, BadgeCheck, Clock3, UserPlus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';

import {
  destinationKindLabel,
  inCoolingOff,
  railForBeneficiary,
} from '@/features/beneficiaries/beneficiaries.helpers';
import { FavouriteToggle } from '@/features/beneficiaries/favourite-toggle';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Payees' };

/**
 * Saved payees: searchable, favourites first, recent activity up top. New payees carry their
 * cooling-off window visibly until it lapses.
 */
export default async function BeneficiariesPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ q?: string; favourites?: string }> }>) {
  const params = await searchParams;
  const query = new URLSearchParams({ limit: '100' });
  if (params.q) {
    query.set('q', params.q);
  }
  if (params.favourites === 'true') {
    query.set('favouritesOnly', 'true');
  }

  const page = await api<CursorPage<Beneficiary>>(`/beneficiaries?${query.toString()}`, {
    tags: ['beneficiaries'],
  });

  const recent = [...page.items]
    .filter((b) => b.lastUsedAt !== null)
    .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    .slice(0, 3);

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Payees</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            The people and businesses you pay. New payees have a short cooling-off window.
          </p>
        </div>
        <Link
          href="/beneficiaries/new"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          <UserPlus size={16} />
          Add payee
        </Link>
      </header>

      <form method="GET" action="/beneficiaries" className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="payee-search" className="sr-only">
          Search payees
        </label>
        <Input
          id="payee-search"
          type="search"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="Search by name or account"
          className="h-10 min-w-64 flex-1"
        />
        <Checkbox
          name="favourites"
          value="true"
          defaultChecked={params.favourites === 'true'}
          label="Favourites only"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {recent.length > 0 && !params.q ? (
        <section aria-labelledby="recent" className="mt-8">
          <h2 id="recent" className="text-sm font-medium text-[var(--icb-text-muted)]">
            Recently paid
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {recent.map((payee) => (
              <Link
                key={payee.id}
                href={`/beneficiaries/${payee.id}` as Route}
                className="rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] p-4 transition-colors hover:border-[var(--icb-primary)]"
              >
                <p className="truncate text-sm font-medium">{payee.nickname ?? payee.name}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--icb-text-subtle)]">
                  {payee.displayIdentifier}
                </p>
                <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
                  Last paid {payee.lastUsedAt ? formatDate(payee.lastUsedAt, 'medium') : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="mt-6 overflow-hidden">
        {page.items.length > 0 ? (
          <ul className="divide-y divide-[var(--icb-border)]">
            {page.items.map((payee) => (
              <PayeeRow key={payee.id} payee={payee} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Users size={20} />}
            title={params.q ? 'No payees match' : 'No payees yet'}
            description={
              params.q
                ? 'Try a different name or account number.'
                : 'Add someone you pay regularly and they will be one tap away.'
            }
          />
        )}
      </Card>
    </>
  );
}

function PayeeRow({ payee }: Readonly<{ payee: Beneficiary }>) {
  const rail = railForBeneficiary(payee);
  const cooling = inCoolingOff(payee);

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <FavouriteToggle
        beneficiaryId={payee.id}
        favourite={payee.favourite}
        name={payee.nickname ?? payee.name}
      />
      <div className="min-w-0 flex-1">
        <Link
          href={`/beneficiaries/${payee.id}` as Route}
          className="truncate text-sm font-medium hover:text-[var(--icb-primary)] hover:underline"
        >
          {payee.nickname ?? payee.name}
        </Link>
        <p className="mt-0.5 truncate font-mono text-xs text-[var(--icb-text-subtle)]">
          {destinationKindLabel(payee)} · {payee.displayIdentifier}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {payee.verified ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--icb-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--icb-success-fg)]">
              <BadgeCheck size={12} aria-hidden="true" />
              Verified
            </span>
          ) : null}
          {cooling && payee.coolingOffUntil ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--icb-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--icb-warning-fg)]">
              <Clock3 size={12} aria-hidden="true" />
              Cooling off until {formatDate(payee.coolingOffUntil, 'short')}{' '}
              {formatTime(payee.coolingOffUntil)}
            </span>
          ) : null}
        </div>
      </div>
      {rail ? (
        <Link
          href={`/transfer/new?rail=${rail}&payee=${payee.id}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] px-3 text-[0.8125rem] font-medium transition-colors hover:bg-[var(--icb-bg-muted)]"
        >
          <ArrowLeftRight size={14} />
          Pay
        </Link>
      ) : null}
    </li>
  );
}
