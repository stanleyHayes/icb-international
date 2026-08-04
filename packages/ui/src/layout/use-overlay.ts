'use client';

import { useEffect, type RefObject } from 'react';

import { KEYS } from './keyboard';
import { FOCUSABLE_SELECTOR } from './layout.constants';

/**
 * Overlay behaviour hooks.
 *
 * There is no Radix in the dependency tree, so the accessibility plumbing a modal needs —
 * Escape to close, focus trapping, scroll locking, outside-click dismissal — is implemented
 * here by hand, once, and shared by Dialog, Sheet, Drawer, Popover, and DropdownMenu.
 */

/** Close on Escape while the overlay is active. */
export function useEscapeClose(active: boolean, onClose: (() => void) | undefined): void {
  useEffect(() => {
    if (!active || !onClose) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);
}

/** Lock body scroll while a modal overlay is open. */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Invoke `handler` on pointer presses outside the referenced element (menus, popovers). */
export function useOutsidePointerDown(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  handler: () => void,
): void {
  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const element = ref.current;
      if (element && event.target instanceof Node && !element.contains(event.target)) handler();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref, active, handler]);
}

/**
 * Trap Tab inside the referenced container while active: focus moves in on entry, cycles
 * between the first and last focusable element, and returns to the previously focused
 * element on exit. This is the keyboard half of `aria-modal`.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusFirstElement(container);
    const onKeyDown = (event: KeyboardEvent) => trapTabKey(event, container);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [ref, active]);
}

function focusFirstElement(container: HTMLElement): void {
  const target = getFocusable(container).at(0) ?? container;
  target.focus();
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function trapTabKey(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== KEYS.TAB) return;
  const focusable = getFocusable(container);
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const activeElement = document.activeElement;
  const escaped = !container.contains(activeElement);
  if (event.shiftKey && (activeElement === first || escaped)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (activeElement === last || escaped)) {
    event.preventDefault();
    first.focus();
  }
}
