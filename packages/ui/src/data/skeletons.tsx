import { cn } from '../lib/cn';
import { Skeleton } from '../feedback/skeleton';

/** A short paragraph placeholder: full-width lines, last line cut short like real text. */
export function SkeletonText({
  lines = 3,
  className,
}: Readonly<{ lines?: number; className?: string }>) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn('h-3.5', index === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** A table placeholder that mirrors the real grid so the layout does not jump on load. */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: Readonly<{ rows?: number; columns?: number; className?: string }>) {
  return (
    <div
      className={cn(
        'flex flex-col divide-y divide-[var(--icb-border)] rounded-[var(--radius-md)] border border-[var(--icb-border)]',
        className,
      )}
      aria-hidden="true"
    >
      <div className="flex gap-6 px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-6 px-4 py-4">
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton key={column} className={cn('h-3.5', column === 0 ? 'w-32' : 'w-20')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A statement placeholder: a day heading followed by transaction-shaped rows. */
export function SkeletonTransactionList({
  rows = 4,
  className,
}: Readonly<{ rows?: number; className?: string }>) {
  return (
    <div className={cn('flex flex-col gap-1 px-4 py-3', className)} aria-hidden="true">
      <Skeleton className="mb-2 h-3 w-24" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between py-2.5">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  );
}
