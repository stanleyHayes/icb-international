import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface DefinitionItem {
  /** Stable React key. */
  id: string;
  term: ReactNode;
  description: ReactNode;
}

export type DefinitionListProps = Readonly<{
  items: DefinitionItem[];
  /** `grid` puts terms and values side by side; `stacked` suits narrow panels. */
  layout?: 'grid' | 'stacked';
  className?: string;
}>;

/**
 * A term/value list — account details, fee breakdowns, transfer receipts.
 *
 * Renders a real `<dl>` so assistive technology announces the term/description relationship.
 * In `grid` layout each pair is a row; values align right because most descriptions in a bank
 * are amounts and identifiers that scan better flushed to the edge.
 */
export function DefinitionList({ items, layout = 'grid', className }: DefinitionListProps) {
  return (
    <dl
      className={cn(
        layout === 'grid'
          ? 'divide-y divide-[var(--icb-border)]'
          : 'flex flex-col gap-4',
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            layout === 'grid'
              ? 'flex items-baseline justify-between gap-6 py-3'
              : 'flex flex-col gap-0.5',
          )}
        >
          <dt className="shrink-0 text-sm text-[var(--icb-text-muted)]">{item.term}</dt>
          <dd
            className={cn(
              'text-sm font-medium',
              layout === 'grid' && 'text-right tabular',
            )}
          >
            {item.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}
