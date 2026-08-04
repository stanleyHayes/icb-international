'use client';

import type { Biller } from '@icb/contracts';
import { Button } from '@icb/ui';
import { ChevronRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';

import { FormError, TextField } from '../form-controls';
import { linkBillAction, type BillActionState } from './actions';
import type { Route } from 'next';

const INITIAL: BillActionState = { status: 'idle', message: null, fieldErrors: {}, billId: null };

const CATEGORIES = [
  'electricity',
  'water',
  'internet',
  'mobile',
  'tv',
  'insurance',
  'education',
  'government',
  'rent',
  'other',
] as const;

/**
 * The biller directory and the link form behind it.
 *
 * Browsing filters the already-fetched directory client-side so typing is instant; linking posts
 * the biller's own reference label ("Meter number", "Policy number") rather than a generic
 * "account number", because that is what the customer recognises off their paper bill.
 */
export function BillerBrowser({ billers }: Readonly<{ billers: Biller[] }>) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Biller | null>(null);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return billers.filter(
      (biller) =>
        (!category || biller.category === category) &&
        (needle === '' || biller.name.toLowerCase().includes(needle)),
    );
  }, [billers, query, category]);

  if (selected) {
    return <LinkBillForm biller={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div>
      <div className="relative">
        <Search
          size={16}
          aria-hidden="true"
          className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--icb-text-subtle)]"
        />
        <label htmlFor="biller-search" className="sr-only">
          Search billers
        </label>
        <input
          id="biller-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search billers"
          className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] pr-3.5 pl-10 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory((current) => (current === item ? null : item))}
            className={
              category === item
                ? 'rounded-full border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] px-3 py-1.5 text-xs font-medium text-[var(--icb-primary)] capitalize'
                : 'rounded-full border border-[var(--icb-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--icb-text-muted)] capitalize hover:bg-[var(--icb-bg-muted)]'
            }
          >
            {item}
          </button>
        ))}
      </div>

      {matches.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--icb-border)]">
          {matches.map((biller) => (
            <li key={biller.id}>
              <button
                type="button"
                onClick={() => setSelected(biller)}
                className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-[var(--icb-bg-muted)]"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--icb-navy-50)] text-xs font-semibold text-[var(--icb-primary)]"
                >
                  {biller.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{biller.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)] capitalize">
                    {biller.category.replace('_', ' ')}
                    {biller.supportsBalanceEnquiry ? ' · shows balance and due date' : ''}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-[var(--icb-text-subtle)]" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-[var(--icb-text-subtle)]">
          No billers match. Try a different name or category.
        </p>
      )}
    </div>
  );
}

function LinkBillForm({ biller, onBack }: Readonly<{ biller: Biller; onBack: () => void }>) {
  const [state, action, pending] = useActionState(linkBillAction, INITIAL);
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'success' && state.billId) {
      router.push(`/bills/${state.billId}` as Route);
    }
  }, [state.status, state.billId, router]);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="billerId" value={biller.id} />
      <FormError message={state.message} />

      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--icb-navy-50)] text-xs font-semibold text-[var(--icb-primary)]"
        >
          {biller.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-semibold">{biller.name}</p>
          <p className="text-xs text-[var(--icb-text-subtle)] capitalize">{biller.category}</p>
        </div>
      </div>

      <TextField
        label={biller.referenceLabel}
        name="customerReference"
        maxLength={60}
        required
        placeholder={biller.referencePattern ? `e.g. ${biller.referencePattern}` : ''}
        error={state.fieldErrors['customerReference']}
      />

      <TextField
        label="Name this bill"
        name="nickname"
        hint="(optional)"
        maxLength={60}
        placeholder="e.g. Home electricity"
        error={state.fieldErrors['nickname']}
      />

      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Link bill
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Choose a different biller
        </Button>
      </div>
    </form>
  );
}
