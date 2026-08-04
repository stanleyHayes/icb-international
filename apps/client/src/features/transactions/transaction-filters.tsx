'use client';

import type { AccountSummary } from '@icb/contracts';
import { FilterBar, Input, type FilterDescriptor } from '@icb/ui';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TRANSACTION_CATEGORY_OPTIONS, TRANSACTION_STATUS_OPTIONS, TRANSACTION_TYPE_OPTIONS } from './filter-options';

const DEBOUNCE_MS = 400;

const CONTROL =
  'h-9 w-full rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm text-[var(--icb-text)]';

/**
 * The full filter bar for the transactions ledger.
 *
 * Every control is controlled from the URL: a change rewrites the search params (replacing
 * history, so the back button is not polluted with half-typed search terms) and the server
 * re-renders the list beneath. Text inputs debounce; selects apply immediately.
 */
export function TransactionFilters({
  accounts,
}: Readonly<{ accounts: Pick<AccountSummary, 'id' | 'nickname' | 'productName'>[] }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [minAmount, setMinAmount] = useState(searchParams.get('minAmount') ?? '');
  const [maxAmount, setMaxAmount] = useState(searchParams.get('maxAmount') ?? '');

  const apply = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
      router.replace(`${pathname}?${params.toString()}` as Route);
    },
    [pathname, router, searchParams],
  );

  const applyDebounced = useCallback(
    (key: string, value: string) => {
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => apply(key, value), DEBOUNCE_MS);
    },
    [apply],
  );

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  const filters: FilterDescriptor[] = [
    {
      id: 'account',
      label: 'Account',
      value: searchParams.get('account'),
      options: accounts.map((account) => ({
        value: account.id,
        label: account.nickname ?? account.productName,
      })),
    },
    { id: 'direction', label: 'Direction', value: searchParams.get('direction'), options: [
      { value: 'credit', label: 'Money in' },
      { value: 'debit', label: 'Money out' },
    ] },
    { id: 'type', label: 'Type', value: searchParams.get('type'), options: TRANSACTION_TYPE_OPTIONS },
    { id: 'category', label: 'Category', value: searchParams.get('category'), options: TRANSACTION_CATEGORY_OPTIONS },
    { id: 'status', label: 'Status', value: searchParams.get('status'), options: TRANSACTION_STATUS_OPTIONS },
  ];

  return (
    <div className="space-y-3">
      <FilterBar
        filters={filters}
        onFilterChange={(id, value) => apply(id, value)}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          applyDebounced('q', value);
        }}
        searchPlaceholder="Search description or reference"
        onClearAll={() => {
          setSearch('');
          setMinAmount('');
          setMaxAmount('');
          router.replace(pathname as Route);
        }}
      />

      <RangeFilters
        from={searchParams.get('from') ?? ''}
        to={searchParams.get('to') ?? ''}
        minAmount={minAmount}
        maxAmount={maxAmount}
        onMinAmountChange={(value) => {
          setMinAmount(value);
          applyDebounced('minAmount', value);
        }}
        onMaxAmountChange={(value) => {
          setMaxAmount(value);
          applyDebounced('maxAmount', value);
        }}
        onDateChange={apply}
      />
    </div>
  );
}

/** The date window and amount range — one labelled row beneath the facet dropdowns. */
function RangeFilters({
  from,
  to,
  minAmount,
  maxAmount,
  onMinAmountChange,
  onMaxAmountChange,
  onDateChange,
}: Readonly<{
  from: string;
  to: string;
  minAmount: string;
  maxAmount: string;
  onMinAmountChange: (value: string) => void;
  onMaxAmountChange: (value: string) => void;
  onDateChange: (key: string, value: string | null) => void;
}>) {
  return (
    <fieldset className="flex flex-wrap items-end gap-3">
      <legend className="sr-only">Date and amount range</legend>
      <RangeField label="From" id="filter-from">
        <Input
          id="filter-from"
          type="date"
          size="sm"
          value={from}
          onChange={(event) => onDateChange('from', event.target.value)}
        />
      </RangeField>
      <RangeField label="To" id="filter-to">
        <Input
          id="filter-to"
          type="date"
          size="sm"
          value={to}
          onChange={(event) => onDateChange('to', event.target.value)}
        />
      </RangeField>
      <RangeField label="Min amount" id="filter-min">
        <input
          id="filter-min"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={minAmount}
          onChange={(event) => onMinAmountChange(event.target.value)}
          className={CONTROL}
        />
      </RangeField>
      <RangeField label="Max amount" id="filter-max">
        <input
          id="filter-max"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0.00"
          value={maxAmount}
          onChange={(event) => onMaxAmountChange(event.target.value)}
          className={CONTROL}
        />
      </RangeField>
    </fieldset>
  );
}

function RangeField({
  label,
  id,
  children,
}: Readonly<{ label: string; id: string; children: React.ReactNode }>) {
  return (
    <span className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="text-xs font-medium tracking-[0.06em] text-[var(--icb-text-subtle)] uppercase"
      >
        {label}
      </label>
      {children}
    </span>
  );
}
