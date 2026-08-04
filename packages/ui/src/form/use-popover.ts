'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface PopoverState {
  readonly open: boolean;
  readonly openPopover: () => void;
  readonly closePopover: () => void;
  readonly togglePopover: () => void;
  /** Attach to the wrapper containing both trigger and popup. */
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Shared popover behaviour for Combobox and the date pickers: outside-pointer-down and Escape
 * close the popup. Listeners attach only while open, so a closed picker costs nothing.
 */
export function usePopover(): PopoverState {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const openPopover = useCallback(() => setOpen(true), []);
  const closePopover = useCallback(() => setOpen(false), []);
  const togglePopover = useCallback(() => setOpen((current) => !current), []);

  return { open, openPopover, closePopover, togglePopover, containerRef };
}
