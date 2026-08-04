import type { MoneyLike } from '../lib/format';
import { cn } from '../lib/cn';
import { Amount } from './amount';

export type BalanceProps = Readonly<{
  /** The ledger balance — every posted entry, from the double-entry ledger. */
  ledger: MoneyLike;
  /** What can actually be spent: ledger minus holds and pending authorisations. */
  available?: MoneyLike;
  size?: 'md' | 'lg';
  className?: string;
}>;

/**
 * Ledger versus available balance, with the difference explained.
 *
 * A bank that shows one number when two exist teaches customers to distrust the number. When the
 * two differ, both render — ledger first (the record of what happened), available second (what
 * can be spent) — with a plain-language disclosure explaining the gap: holds and pending
 * authorisations that have not posted yet.
 */
export function Balance({ ledger, available, size = 'lg', className }: BalanceProps) {
  const differs = available !== undefined && available.minorUnits !== ledger.minorUnits;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Amount value={ledger} size={size} showCurrency />
      {differs ? (
        <>
          <p className="text-sm text-[var(--icb-text-muted)]">
            <Amount value={available} size="sm" /> available to spend
          </p>
          <details className="group text-sm">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[var(--icb-text-subtle)] underline decoration-dotted underline-offset-4 hover:text-[var(--icb-text)] [&::-webkit-details-marker]:hidden">
              Why is this different?
            </summary>
            <p className="mt-2 max-w-md rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] p-3 text-[var(--icb-text-muted)]">
              The ledger balance includes every posted transaction. The available balance subtracts
              holds and pending card authorisations — money that is reserved but has not left your
              account yet.
            </p>
          </details>
        </>
      ) : null}
    </div>
  );
}
