import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The bar across the top of the app shell. Slots keep it honest: brand/navigation context on
 * the leading edge, optional centre content (e.g. search), session/utility actions trailing.
 * Height is the brand header token so every app measures the same.
 */
export type TopbarProps = Readonly<
  HTMLAttributes<HTMLElement> & {
    leading?: ReactNode;
    trailing?: ReactNode;
    /** Stick to the viewport top while scrolling. Defaults to `true`. */
    sticky?: boolean;
  }
>;

export function Topbar({
  leading,
  trailing,
  sticky = true,
  className,
  children,
  ...props
}: TopbarProps) {
  return (
    <header
      className={cn(
        'flex items-center gap-4 border-b border-[var(--icb-border)] bg-[var(--icb-surface)] px-4 sm:px-6',
        sticky && 'sticky top-0 z-10',
        className,
      )}
      style={{ height: 'var(--icb-header-height)' }}
      {...props}
    >
      {leading ? <div className="flex min-w-0 items-center gap-3">{leading}</div> : null}
      {children ? <div className="flex min-w-0 flex-1 items-center">{children}</div> : null}
      {trailing ? <div className="ml-auto flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </header>
  );
}
