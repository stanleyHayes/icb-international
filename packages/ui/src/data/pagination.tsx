'use client';

import { cn } from '../lib/cn';
import { IconChevronLeft, IconChevronRight } from '../primitives/icons';

export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * The numbered window between first and last page: `1 … 7 8 9 … 42`.
 * Always keeps the first and last page visible so the reader knows the range they are inside.
 */
export function pageWindow(page: number, totalPages: number, siblings = 1): PageItem[] {
  if (totalPages <= 0) {
    return [];
  }
  const first = 1;
  const last = totalPages;
  const start = Math.max(page - siblings, first + 1);
  const end = Math.min(page + siblings, last - 1);
  const items: PageItem[] = [first];
  if (start === first + 2) {
    items.push(first + 1);
  } else if (start > first + 1) {
    items.push('ellipsis-start');
  }
  for (let current = start; current <= end; current++) {
    items.push(current);
  }
  if (end === last - 2) {
    items.push(last - 1);
  } else if (end < last - 1) {
    items.push('ellipsis-end');
  }
  if (last > first) {
    items.push(last);
  }
  return items;
}

const PAGE_BUTTON =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] px-2 text-sm font-medium tabular';
const PAGE_ACTIVE = 'bg-[var(--icb-primary)] text-white';
const PAGE_IDLE =
  'text-[var(--icb-text)] hover:bg-[var(--icb-bg-muted)] disabled:pointer-events-none disabled:opacity-40';

export type PaginationProps = Readonly<{
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Numbered pages kept on each side of the current page. */
  siblings?: number;
  className?: string;
}>;

/**
 * Offset pagination for bounded admin tables.
 *
 * Customer-facing lists paginate by cursor (see TransactionList) because offset pages skip rows
 * when data arrives mid-scroll; this control is for tables whose total is stable and whose page
 * number is genuinely meaningful, such as an audit search.
 */
export function Pagination({ page, totalPages, onPageChange, siblings = 1, className }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }
  const items = pageWindow(page, totalPages, siblings);

  return (
    <nav aria-label="Pagination" className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => { onPageChange(page - 1); }}
        className={cn(PAGE_BUTTON, PAGE_IDLE)}
      >
        <IconChevronLeft size={16} />
      </button>
      {items.map((item) =>
        typeof item === 'number' ? (
          <button
            key={item}
            type="button"
            aria-current={item === page ? 'page' : undefined}
            aria-label={`Page ${item}`}
            onClick={() => { onPageChange(item); }}
            className={cn(PAGE_BUTTON, item === page ? PAGE_ACTIVE : PAGE_IDLE)}
          >
            {item}
          </button>
        ) : (
          <span key={item} aria-hidden="true" className="px-1 text-[var(--icb-text-subtle)]">
            …
          </span>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= totalPages}
        onClick={() => { onPageChange(page + 1); }}
        className={cn(PAGE_BUTTON, PAGE_IDLE)}
      >
        <IconChevronRight size={16} />
      </button>
    </nav>
  );
}
