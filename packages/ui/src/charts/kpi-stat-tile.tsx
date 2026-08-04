import { Amount } from '../data/amount';
import { IconChevronDown, IconChevronUp } from '../primitives/icons';
import { cn } from '../lib/cn';
import type { MoneyLike } from '../lib/format';
import { Skeleton } from '../feedback/skeleton';
import { percentChange } from './lib/aggregate';

export interface KpiStatTileProps {
  label: string;
  /** Current period figure; omit (with `loading` false) for the explicit empty state. */
  value?: MoneyLike | undefined;
  /** Same figure for the comparison period; drives the delta line when positive. */
  previousValue?: MoneyLike | undefined;
  /** What the delta compares against, e.g. "vs last month". */
  comparisonBasis?: string | undefined;
  /** 'credit' when an increase is good news (savings), 'debit' when it is spend. */
  direction?: 'credit' | 'debit' | undefined;
  loading?: boolean | undefined;
  emptyText?: string | undefined;
  className?: string | undefined;
}

const PERCENT_DECIMALS = 1;

/** Direction in words, so the delta never depends on colour alone. */
function trendWord(pct: number): string {
  if (pct > 0) return 'up';
  if (pct < 0) return 'down';
  return 'unchanged';
}

function DeltaLine({
  value,
  previousValue,
  basis,
}: Readonly<{ value: MoneyLike; previousValue: MoneyLike; basis: string }>) {
  const pct = percentChange(value.minorUnits, previousValue.minorUnits);
  if (pct === null) return null;
  const up = pct > 0;
  const Icon = up ? IconChevronUp : IconChevronDown;
  return (
    <p className="mt-1 flex items-center gap-1 text-sm">
      <Icon size={16} className={up ? 'text-[var(--icb-credit)]' : 'text-[var(--icb-danger)]'} />
      <span className={cn('tabular font-medium', up ? 'text-[var(--icb-credit)]' : 'text-[var(--icb-danger)]')}>
        {trendWord(pct)} {Math.abs(pct).toFixed(PERCENT_DECIMALS)}%
      </span>
      <span className="text-[var(--icb-text-subtle)]">{basis}</span>
    </p>
  );
}

/**
 * Headline metric with period delta. The delta is an icon plus the words "up"/"down" —
 * colour supports the text, it never replaces it.
 */
export function KpiStatTile({
  label,
  value,
  previousValue,
  comparisonBasis = 'vs previous period',
  direction,
  loading = false,
  emptyText = 'No data for this period',
  className,
}: Readonly<KpiStatTileProps>) {
  if (loading) {
    return (
      <div role="status" aria-label={`${label} is loading`} className={cn('space-y-2', className)}>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>
    );
  }
  if (!value) {
    return (
      <div className={className}>
        <p className="text-sm text-[var(--icb-text-muted)]">{label}</p>
        <p className="mt-1 text-sm text-[var(--icb-text-subtle)]">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className={className}>
      <p className="text-sm text-[var(--icb-text-muted)]">{label}</p>
      <p className="mt-1">
        <Amount value={value} size="xl" {...(direction === undefined ? {} : { direction })} />
      </p>
      {previousValue ? (
        <DeltaLine value={value} previousValue={previousValue} basis={comparisonBasis} />
      ) : null}
    </div>
  );
}
