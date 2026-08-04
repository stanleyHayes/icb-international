'use client';

import type { LoanProduct } from '@icb/contracts';
import { Amount, Button } from '@icb/ui';
import { AlertCircle } from 'lucide-react';

export function ProductStep({
  products,
  selected,
  onSelect,
  onNext,
}: Readonly<{
  products: LoanProduct[];
  selected: string;
  onSelect: (code: string) => void;
  onNext: () => void;
}>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">What are you borrowing for?</legend>
      <div className="mt-3 grid gap-3">
        {products.map((product) => (
          <button
            key={product.code}
            type="button"
            aria-pressed={selected === product.code}
            onClick={() => onSelect(product.code)}
            className={
              selected === product.code
                ? 'rounded-[var(--radius-lg)] border border-[var(--icb-primary)] bg-[var(--icb-navy-50)] p-4 text-left'
                : 'rounded-[var(--radius-lg)] border border-[var(--icb-border-strong)] p-4 text-left hover:bg-[var(--icb-bg-muted)]'
            }
          >
            <span className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-semibold">{product.name}</span>
              <span className="tabular text-sm font-semibold text-[var(--icb-primary)]">
                from {product.fromRate}%
              </span>
            </span>
            <span className="mt-1 block text-xs text-[var(--icb-text-subtle)]">
              <Amount value={product.minimumAmount} size="sm" /> to{' '}
              <Amount value={product.maximumAmount} size="sm" /> · {product.minimumTermMonths}–
              {product.maximumTermMonths} months
            </span>
          </button>
        ))}
      </div>
      <Button className="mt-5" onClick={onNext}>
        Continue
      </Button>
    </fieldset>
  );
}

export function AmountStep({
  product,
  amountDraft,
  termMonths,
  quoteError,
  quoting,
  onAmount,
  onTerm,
  onBack,
  onQuote,
}: Readonly<{
  product: LoanProduct;
  amountDraft: string;
  termMonths: number;
  quoteError: string | null;
  quoting: boolean;
  onAmount: (draft: string) => void;
  onTerm: (months: number) => void;
  onBack: () => void;
  onQuote: () => void;
}>) {
  return (
    <div className="space-y-5">
      {quoteError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {quoteError}
        </p>
      ) : null}

      <div>
        <label htmlFor="loan-amount" className="block text-sm font-medium">
          How much
        </label>
        <div className="relative mt-1.5">
          <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-[var(--icb-text-subtle)]">
            {product.currency}
          </span>
          <input
            id="loan-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amountDraft}
            onChange={(event) => onAmount(event.target.value)}
            className="tabular h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] pr-3.5 pl-14 text-right text-lg font-semibold outline-none focus:border-[var(--icb-primary)]"
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
          <Amount value={product.minimumAmount} size="sm" /> to{' '}
          <Amount value={product.maximumAmount} size="sm" />
        </p>
      </div>

      <div>
        <label htmlFor="loan-term" className="block text-sm font-medium">
          Over <span className="tabular">{termMonths}</span> months
        </label>
        <input
          id="loan-term"
          type="range"
          min={product.minimumTermMonths}
          max={product.maximumTermMonths}
          step={1}
          value={termMonths}
          onChange={(event) => onTerm(Number(event.target.value))}
          className="mt-2 w-full accent-[var(--icb-primary)]"
        />
        <p className="flex justify-between text-xs text-[var(--icb-text-subtle)]">
          <span>{product.minimumTermMonths} months</span>
          <span>{product.maximumTermMonths} months</span>
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onQuote} loading={quoting} disabled={amountDraft.trim() === ''}>
          Check my rate
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
