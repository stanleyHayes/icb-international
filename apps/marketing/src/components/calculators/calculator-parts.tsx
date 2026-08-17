'use client';

import { cn, Field, Select } from '@icb/ui';
import type { CurrencyCode } from '@icb/money';
import type { ReactNode } from 'react';

/** The currencies a calculator can work in — the bank's most-used, not all fifteen. */
export const CALCULATOR_CURRENCIES = [
  { code: 'USD', label: 'US dollar (USD)' },
  { code: 'GHS', label: 'Ghanaian cedi (GHS)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'Pound sterling (GBP)' },
  { code: 'NGN', label: 'Nigerian naira (NGN)' },
  { code: 'KES', label: 'Kenyan shilling (KES)' },
  { code: 'ZAR', label: 'South African rand (ZAR)' },
] as const satisfies readonly { code: CurrencyCode; label: string }[];

/** A labelled currency picker, shared by the money calculators so they behave identically. */
export function CurrencyField({
  value,
  onChange,
}: Readonly<{ value: CurrencyCode; onChange: (code: CurrencyCode) => void }>) {
  return (
    <Field label="Currency">
      <Select value={value} onChange={(event) => onChange(event.target.value as CurrencyCode)}>
        {CALCULATOR_CURRENCIES.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/**
 * The live results region every calculator renders. `role="status"` with `aria-live="polite"`
 * means a screen reader announces the new figures as they change, without stealing focus.
 */
export function ResultPanel({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] p-5"
    >
      <h3 className="text-xs font-semibold tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
        {title}
      </h3>
      <dl className="mt-4 space-y-3">{children}</dl>
    </div>
  );
}

/** One labelled figure inside a {@link ResultPanel}. */
export function ResultRow({
  label,
  value,
  prominent = false,
}: Readonly<{ label: string; value: string; prominent?: boolean }>) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-[var(--icb-text-muted)]">{label}</dt>
      <dd
        key={prominent ? value : undefined}
        className={cn(
          'tabular text-right font-semibold',
          prominent ? 'animate-fade font-display text-2xl' : 'text-sm',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** "47" months read aloud as "3 years and 11 months". */
export function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years === 1 ? '1 year' : `${years} years`;
  const monthPart = rest === 1 ? '1 month' : `${rest} months`;
  if (years === 0) {
    return monthPart;
  }
  return rest === 0 ? yearPart : `${yearPart} and ${monthPart}`;
}
