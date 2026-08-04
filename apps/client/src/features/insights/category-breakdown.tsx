import type { SpendByCategory } from '@icb/contracts';
import { Amount } from '@icb/ui';

/** Human-readable category label: 'groceries' → 'Groceries'. */
function labelOf(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replaceAll('_', ' ');
}

/** Signed percentage with one decimal, or '—' when there is no previous period to compare. */
function changeLabel(change: number | null): string {
  if (change === null) return '—';
  const percent = change * 100;
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(0)}%`;
}

/**
 * The legend under the spend donut: each category with its share of the period and how that
 * compares with the period before it. A rising spend category is the fact a customer acts on,
 * so the change is given the same visual weight as the amount.
 */
export function CategoryBreakdown({
  categories,
}: Readonly<{ categories: SpendByCategory['categories'] }>) {
  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {categories.map((row) => (
        <li key={row.category} className="flex items-center gap-4 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{labelOf(row.category)}</p>
            <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
              {row.transactionCount} transaction{row.transactionCount === 1 ? '' : 's'} ·{' '}
              {Math.round(row.share * 100)}% of spend
            </p>
          </div>
          <span
            className={
              row.changeFromPreviousPeriod !== null && row.changeFromPreviousPeriod > 0
                ? 'text-xs font-medium text-[var(--icb-danger-fg)]'
                : 'text-xs font-medium text-[var(--icb-text-subtle)]'
            }
            aria-label={
              row.changeFromPreviousPeriod === null
                ? 'No previous period to compare'
                : `${changeLabel(row.changeFromPreviousPeriod)} versus previous period`
            }
          >
            {changeLabel(row.changeFromPreviousPeriod)}
          </span>
          <Amount value={row.amount} size="sm" className="w-24 text-right" />
        </li>
      ))}
    </ul>
  );
}
