'use client';

import { useId, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { OverlayCloseButton, OverlayFrame } from './overlay-frame';

/**
 * The modal. Used sparingly: confirmations, focused forms, detail that must interrupt.
 * Focus is trapped, Escape and the backdrop close, and the title names the dialog via
 * `aria-labelledby`. Built by hand on `OverlayFrame` — no Radix in the dependency tree.
 */
export type DialogProps = Readonly<{
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Footer actions — primary action last (rightmost). */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}>;

const SIZE_CLASS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' } as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  className,
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  if (!open) return null;
  return (
    <OverlayFrame
      onClose={onClose}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      wrapperClassName="flex overflow-y-auto p-4"
      className={cn(
        'relative m-auto w-full rounded-[var(--radius-xl)] border border-[var(--icb-border)]',
        'bg-[var(--icb-surface)] shadow-[var(--shadow-xl)]',
        SIZE_CLASS[size],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-5">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-sm text-[var(--icb-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        <OverlayCloseButton onClose={onClose} />
      </div>
      {children ? <div className="px-6 py-4">{children}</div> : null}
      {footer ? (
        <div className="flex justify-end gap-3 rounded-b-[var(--radius-xl)] border-t border-[var(--icb-border)] px-6 py-4">
          {footer}
        </div>
      ) : null}
    </OverlayFrame>
  );
}
