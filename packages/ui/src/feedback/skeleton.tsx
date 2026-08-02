import { cn } from '../lib/cn';

/** Loading placeholder. Sized by the caller so the layout does not shift when content arrives. */
export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[var(--radius-sm)] bg-[var(--icb-bg-muted)] motion-reduce:animate-none',
        className,
      )}
      aria-hidden="true"
    />
  );
}
