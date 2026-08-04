'use client';

import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { KEYS } from './keyboard';
import { Z_INDEX } from './layout.constants';

/**
 * A short label for an otherwise unlabelled control (icon buttons, truncated values).
 * Shows on hover and keyboard focus, hides on Escape; the trigger gets
 * `aria-describedby` while the tip is visible. Not for essential content — a tooltip must
 * never be the only place information lives.
 */
export type TooltipProps = Readonly<{
  content: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
  /** A single focusable element (button, link) the tip describes. */
  children: ReactElement<{ 'aria-describedby'?: string }>;
}>;

export function Tooltip({ content, side = 'top', className, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      onKeyDownCapture={(event) => {
        if (event.key === KEYS.ESCAPE) setOpen(false);
      }}
    >
      {cloneElement(children, open ? { 'aria-describedby': tipId } : {})}
      {open ? (
        <span
          role="tooltip"
          id={tipId}
          style={{ zIndex: Z_INDEX.tooltip }}
          className={cn(
            'pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap',
            'rounded-[var(--radius-sm)] bg-[var(--icb-navy-900)] px-2.5 py-1.5 text-xs font-medium',
            'text-white shadow-[var(--shadow-md)]',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
