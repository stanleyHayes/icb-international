'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { OverlayCloseButton, OverlayFrame } from './overlay-frame';

/**
 * The mobile bottom sheet: thumb-reach actions and short forms on small screens. Anchored to
 * the bottom edge with a drag-handle affordance and rounded top corners. Modal semantics
 * (focus trap, Escape, backdrop) come from `OverlayFrame`.
 */
export type DrawerProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}>;

export function Drawer({ open, onClose, title, className, children }: DrawerProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <OverlayFrame
      onClose={onClose}
      labelledBy={title ? titleId : undefined}
      className={cn(
        'absolute inset-x-0 bottom-0 mx-auto flex max-h-[85vh] w-full max-w-lg flex-col',
        'rounded-t-[var(--radius-xl)] border-t border-[var(--icb-border)]',
        'bg-[var(--icb-surface)] shadow-[var(--shadow-xl)]',
        className,
      )}
    >
      <div aria-hidden="true" className="flex justify-center pt-2">
        <span className="h-1 w-9 rounded-full bg-[var(--icb-border-strong)]" />
      </div>
      <div className="flex items-center justify-between gap-4 px-5 pt-2 pb-3">
        {title ? (
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
        ) : (
          <span />
        )}
        <OverlayCloseButton onClose={onClose} />
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-6">{children}</div>
    </OverlayFrame>
  );
}
