import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * Empty states say what is missing and what to do about it.
 *
 * A blank panel reads as a bug; "No transactions yet — make a transfer to see activity here"
 * reads as a state. Every list in ICB has one.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: Readonly<{
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}
    >
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-[var(--icb-text-subtle)]">
          {icon}
        </div>
      ) : null}
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--icb-text-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
