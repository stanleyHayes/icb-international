import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

/** The standard surface. One border, one radius, one shadow — used everywhere so nothing drifts. */
export function Card({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] shadow-[var(--shadow-xs)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5 pb-3', className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-[var(--icb-text-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn('border-t border-[var(--icb-border)] px-5 py-3 text-sm', className)}
      {...props}
    />
  );
}
