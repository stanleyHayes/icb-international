'use client';

import { cn } from '../lib/cn';
import { IconClose, IconSearch } from '../primitives/icons';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDescriptor {
  id: string;
  label: string;
  options: FilterOption[];
  /** The active value, or null for "all". Controlled — the parent owns filter state. */
  value: string | null;
}

export type FilterBarProps = Readonly<{
  filters: FilterDescriptor[];
  onFilterChange: (id: string, value: string | null) => void;
  /** Presence of both enables the search field. */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onClearAll?: () => void;
  className?: string;
}>;

const CONTROL =
  'h-9 rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3 text-sm text-[var(--icb-text)]';

/**
 * The filter strip above a list or table: search plus one dropdown per facet.
 *
 * State is fully controlled — the bar reflects `filters[].value` and reports changes, it does
 * not remember anything itself. Active filters also render as removable chips so the reader can
 * see at a glance why the list below is short, and "Clear all" appears only when something is
 * actually filtered.
 */
export function FilterBar({
  filters,
  onFilterChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  onClearAll,
  className,
}: FilterBarProps) {
  const active = filters.filter((filter) => filter.value !== null);
  const searching = searchValue !== undefined && onSearchChange !== undefined;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {searching ? (
          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--icb-text-subtle)]"
            />
            <input
              type="search"
              value={searchValue}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => { onSearchChange(event.target.value); }}
              className={cn(CONTROL, 'w-56 pl-9')}
            />
          </div>
        ) : null}
        {filters.map((filter) => (
          <span key={filter.id}>
            <label className="sr-only" htmlFor={`filter-${filter.id}`}>
              {filter.label}
            </label>
            <select
              id={`filter-${filter.id}`}
              value={filter.value ?? ''}
              onChange={(event) => {
                onFilterChange(filter.id, event.target.value === '' ? null : event.target.value);
              }}
              className={cn(CONTROL, filter.value !== null && 'border-[var(--icb-primary)]')}
            >
              <option value="">{filter.label}: all</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        ))}
        {active.length > 0 && onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm font-medium text-[var(--icb-primary)] underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        ) : null}
      </div>
      {active.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Active filters">
          {active.map((filter) => (
            <li key={filter.id}>
              <button
                type="button"
                onClick={() => { onFilterChange(filter.id, null); }}
                aria-label={`Remove filter ${filter.label}`}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--icb-gold-50)] px-2.5 py-1 text-xs font-medium text-[var(--icb-gold-700)] ring-1 ring-[var(--icb-gold-200)] ring-inset"
              >
                {filter.label}: {filter.options.find((option) => option.value === filter.value)?.label ?? filter.value}
                <IconClose size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
