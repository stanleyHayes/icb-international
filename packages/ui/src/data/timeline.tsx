import type { ReactNode } from 'react';

import { cn } from '../lib/cn';
import { formatDate, formatTime } from '../lib/format';

export type TimelineTone = 'default' | 'success' | 'warning' | 'danger';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string | Date;
  tone?: TimelineTone;
  icon?: ReactNode;
}

const TONE_DOTS: Record<TimelineTone, string> = {
  default: 'bg-[var(--icb-slate-300)]',
  success: 'bg-[var(--icb-success-fg)]',
  warning: 'bg-[var(--icb-warning-fg)]',
  danger: 'bg-[var(--icb-danger-fg)]',
};

function TimelineEntry({ item, last }: Readonly<{ item: TimelineItem; last: boolean }>) {
  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {!last ? (
        <span
          aria-hidden="true"
          className="absolute top-3 left-[5px] h-full w-px bg-[var(--icb-border)]"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn('z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full', TONE_DOTS[item.tone ?? 'default'])}
      >
        {item.icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{item.title}</p>
          <time
            dateTime={new Date(item.timestamp).toISOString()}
            className="shrink-0 text-xs whitespace-nowrap text-[var(--icb-text-subtle)]"
          >
            {formatDate(item.timestamp, 'short')} · {formatTime(item.timestamp)}
          </time>
        </div>
        {item.description ? (
          <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">{item.description}</p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * An ordered event history — KYC progress, dispute stages, transfer settlement hops.
 *
 * Renders as a semantic ordered list: the sequence is the meaning, so it must survive without
 * the dots and the line. Callers pass items newest-first or oldest-first; the component keeps
 * the given order.
 */
export function Timeline({
  items,
  className,
}: Readonly<{ items: TimelineItem[]; className?: string }>) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {items.map((item, index) => (
        <TimelineEntry key={item.id} item={item} last={index === items.length - 1} />
      ))}
    </ol>
  );
}
