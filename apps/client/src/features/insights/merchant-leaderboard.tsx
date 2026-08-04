import { Amount } from '@icb/ui';

import type { MerchantTotal } from './derive';

/**
 * Where the money actually went: the counterparties that took the most over the window,
 * ranked. Rank matters more than precision here — the point is to spot the one merchant that
 * quietly eats the budget.
 */
export function MerchantLeaderboard({
  merchants,
  currency,
}: Readonly<{ merchants: readonly MerchantTotal[]; currency: string }>) {
  const top = merchants[0]?.totalMinorUnits ?? 0;

  return (
    <ol className="divide-y divide-[var(--icb-border)]">
      {merchants.map((merchant, index) => (
        <li key={merchant.name} className="flex items-center gap-4 px-5 py-3">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-xs font-semibold text-[var(--icb-text-muted)]"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{merchant.name}</p>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--icb-bg-muted)]"
              role="img"
              aria-label={`${Math.round(top === 0 ? 0 : (merchant.totalMinorUnits / top) * 100)}% of the top merchant's spend`}
            >
              <div
                className="h-full rounded-full bg-[var(--icb-primary)]"
                style={{
                  width: `${top === 0 ? 0 : Math.max(3, (merchant.totalMinorUnits / top) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="text-right">
            <Amount value={{ minorUnits: merchant.totalMinorUnits, currency }} size="sm" />
            <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
              {merchant.transactionCount} payment{merchant.transactionCount === 1 ? '' : 's'}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
