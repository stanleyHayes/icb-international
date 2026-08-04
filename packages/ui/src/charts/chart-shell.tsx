import type { ReactNode } from 'react';

import { EmptyState } from '../feedback/empty-state';
import { Skeleton } from '../feedback/skeleton';
import { CHART_EMPTY_DESCRIPTION, CHART_EMPTY_TITLE } from './chart.constants';
import type { ChartState } from './lib/aggregate';

export interface ChartShellProps {
  state: ChartState;
  /** Accessible name of the chart, used for the loading announcement. */
  label: string;
  height: number;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
}

/**
 * Every chart renders exactly one of three faces: a skeleton while loading, an explicit empty
 * state when there is nothing to draw, or the chart itself. Centralising the switch keeps the
 * three faces consistent and guarantees no chart ever renders a blank panel.
 */
export function ChartShell({
  state,
  label,
  height,
  emptyTitle = CHART_EMPTY_TITLE,
  emptyDescription = CHART_EMPTY_DESCRIPTION,
  className,
  children,
}: Readonly<ChartShellProps>) {
  if (state === 'loading') {
    return (
      <div role="status" aria-label={`${label} is loading`} className={className}>
        <Skeleton className="w-full" />
        <div style={{ height }}>
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div className={className}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }
  return <div className={className}>{children}</div>;
}
