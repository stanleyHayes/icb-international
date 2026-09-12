'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../lib/cn';
import { IconClose } from '../primitives/icons';
import { Z_INDEX } from './layout.constants';
import { useEscapeClose, useFocusTrap, useScrollLock } from './use-overlay';

/**
 * The shared modal frame behind Dialog, Sheet, Drawer, and CommandPalette: dimmed backdrop,
 * `role="dialog"` + `aria-modal`, Escape to close, focus trap, and a body scroll lock.
 * Not exported from the package barrel — consumers use the named overlays.
 *
 * Rendered through a portal on `document.body`, which is what makes `fixed inset-0` mean the
 * viewport. Left in place, an overlay is laid out against its nearest *containing block*, and
 * any ancestor carrying `transform`, `filter`, `backdrop-filter`, `perspective`, `contain` or
 * `will-change` becomes one. Both app headers use `backdrop-blur`, so the page-help drawer
 * opened from the top bar was being sized to the 64px header and painted inside it. A `z-index`
 * cannot rescue that: `position: relative` on the same header opens a stacking context the
 * overlay's own z-index is then scoped to. The portal sidesteps both, for every overlay and
 * every mount point, rather than leaving the next `transform` to reintroduce it.
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
  // `createPortal` needs a live document, so the server pass renders nothing and the overlay
  // attaches once mounted. Nothing is lost: an overlay only ever opens from an interaction, so
  // it is closed during server rendering anyway.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => setContainer(document.body), []);

  useEscapeClose(true, onClose);
  useScrollLock(true);
  // Gated on the portal, not on `true`: the panel node does not exist until the portal mounts,
  // and a trap that runs against a null ref never re-runs to find one.
  useFocusTrap(panelRef, container !== null);

  if (!container) {
    return null;
  }

  return createPortal(
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
    </div>,
    container,
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
