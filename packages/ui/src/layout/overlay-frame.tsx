'use client';

import { useRef, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { IconClose } from '../primitives/icons';
import { Z_INDEX } from './layout.constants';
import { useEscapeClose, useFocusTrap, useScrollLock } from './use-overlay';

/**
 * The shared modal frame behind Dialog, Sheet, Drawer, and CommandPalette: dimmed backdrop,
 * `role="dialog"` + `aria-modal`, Escape to close, focus trap, and a body scroll lock.
 * Not exported from the package barrel — consumers use the named overlays.
 */
export interface OverlayFrameProps {
  onClose: () => void;
  /** id of the element that names the dialog (usually the title). */
  labelledBy?: string | undefined;
  /** id of the element that describes the dialog. */
  describedBy?: string | undefined;
  role?: 'dialog' | 'alertdialog';
  /** Render the dimmed backdrop. Defaults to `true`. */
  backdrop?: boolean;
  /** A backdrop press closes the overlay. Defaults to `true`. */
  closeOnBackdrop?: boolean;
  /** Panel layout classes — position and shape come from the caller. */
  className?: string | undefined;
  /** Layout classes for the full-screen positioning wrapper. */
  wrapperClassName?: string | undefined;
  children: ReactNode;
}

export function OverlayFrame({
  onClose,
  labelledBy,
  describedBy,
  role = 'dialog',
  backdrop = true,
  closeOnBackdrop = true,
  className,
  wrapperClassName,
  children,
}: Readonly<OverlayFrameProps>) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeClose(true, onClose);
  useScrollLock(true);
  useFocusTrap(panelRef, true);
  return (
    <div className={cn('fixed inset-0', wrapperClassName)} style={{ zIndex: Z_INDEX.overlay }}>
      {backdrop ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--icb-navy-950)]/40"
          onClick={closeOnBackdrop ? onClose : undefined}
        />
      ) : null}
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={className}
      >
        {children}
      </div>
    </div>
  );
}

/** The standard overlay close button — one glyph, one position, one accessible name. */
export function OverlayCloseButton({ onClose }: Readonly<{ onClose: () => void }>) {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]',
        'text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
      )}
    >
      <IconClose />
    </button>
  );
}
