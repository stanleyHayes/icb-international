import type { Route } from 'next';
import Link from 'next/link';

export interface FilterPill {
  key: string;
  label: string;
  href: Route;
  active: boolean;
}

function pillClass(active: boolean): string {
  return active
    ? 'inline-flex h-8 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-3 text-xs font-medium text-white capitalize'
    : 'inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] px-3 text-xs font-medium capitalize transition-colors hover:bg-[var(--icb-bg-muted)]';
}

/**
 * A labelled row of filter pills.
 *
 * Filters are navigation, not form state: the selection lives in the URL, so a queue view can be
 * bookmarked and shared between analysts exactly as it was seen.
 */
export function FilterPills({
  label,
  pills,
}: Readonly<{ label: string; pills: readonly FilterPill[] }>) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Filter by ${label}`}>
      <span className="text-xs text-[var(--icb-text-subtle)]">{label}</span>
      {pills.map((pill) => (
        <Link
          key={pill.key}
          href={pill.href}
          className={pillClass(pill.active)}
          aria-current={pill.active ? 'page' : undefined}
        >
          {pill.label}
        </Link>
      ))}
    </div>
  );
}
