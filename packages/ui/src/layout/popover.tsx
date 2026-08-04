'use client';

import { useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Z_INDEX } from './layout.constants';
import { useEscapeClose, useOutsidePointerDown } from './use-overlay';

/**
 * Non-modal content anchored to a trigger: explainers, quick forms, secondary detail.
 * Unlike Dialog it does not trap focus or lock scroll — it dismisses on Escape, on a pointer
 * press outside, or on the trigger. The trigger is always a real button with
 * `aria-expanded`/`aria-controls` wiring.
 */
export type PopoverProps = Readonly<{
  /** Content rendered inside the trigger button. */
  trigger: ReactNode;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  side?: 'top' | 'bottom';
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}>;

export function Popover({
  trigger,
  triggerLabel,
  side = 'bottom',
  align = 'start',
  className,
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const close = () => setOpen(false);
  useOutsidePointerDown(rootRef, open, close);
  useEscapeClose(open, close);
  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={triggerLabel}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="dialog"
          id={panelId}
          style={{ zIndex: Z_INDEX.dropdown }}
          className={cn(
            'absolute min-w-64 rounded-[var(--radius-lg)] border border-[var(--icb-border)]',
            'bg-[var(--icb-surface)] p-4 shadow-[var(--shadow-lg)]',
            side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            align === 'start' ? 'left-0' : 'right-0',
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}
