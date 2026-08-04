'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { OverlayCloseButton, OverlayFrame } from './overlay-frame';

/**
 * An edge-anchored modal panel — account details, filters, secondary navigation — that keeps
 * the page behind it visible. Same modal semantics as Dialog (focus trap, Escape, backdrop);
 * only the geometry differs.
 */
export type SheetProps = Readonly<{
  open: boolean;
  onClose: () => void;
  /** Which viewport edge the panel slides from. Defaults to `right`. */
  side?: 'left' | 'right' | 'top' | 'bottom';
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}>;

const SIDE_CLASS = {
  right: 'inset-y-0 right-0 h-full w-full max-w-md border-s border-[var(--icb-border)]',
  left: 'inset-y-0 left-0 h-full w-full max-w-md border-e border-[var(--icb-border)]',
  top: 'inset-x-0 top-0 max-h-[80vh] border-b border-[var(--icb-border)]',
  bottom: 'inset-x-0 bottom-0 max-h-[80vh] border-t border-[var(--icb-border)]',
} as const;

export function Sheet({ open, onClose, side = 'right', title, className, children }: SheetProps) {
  const titleId = useId();
  if (!open) return null;
  return (
    <OverlayFrame
      onClose={onClose}
      labelledBy={title ? titleId : undefined}
      className={cn(
        'absolute flex flex-col overflow-y-auto bg-[var(--icb-surface)] shadow-[var(--shadow-xl)]',
        SIDE_CLASS[side],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--icb-border)] px-5 py-4">
        {title ? (
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
        ) : (
          <span />
        )}
        <OverlayCloseButton onClose={onClose} />
      </div>
      <div className="flex-1 px-5 py-4">{children}</div>
    </OverlayFrame>
  );
}
