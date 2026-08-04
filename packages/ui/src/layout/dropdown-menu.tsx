'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

import { cn } from '../lib/cn';
import { KEYS, firstEnabledIndex, keyToRovingIntent, resolveRovingIndex } from './keyboard';
import { Z_INDEX } from './layout.constants';
import { useEscapeClose, useOutsidePointerDown } from './use-overlay';

/**
 * Action menus (row overflow, account actions). Implements the ARIA menu button pattern:
 * the trigger opens with click/Enter/Space/ArrowDown; the menu is a roving-tabindex list —
 * arrows move, Home/End jump, Enter/Space activate, Escape closes and refocuses the trigger,
 * Tab closes without returning focus.
 */
export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Destructive styling for irreversible actions. */
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export type DropdownMenuProps = Readonly<{
  /** Content rendered inside the trigger button. */
  trigger: ReactNode;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  items: readonly DropdownMenuItem[];
  align?: 'start' | 'end';
  className?: string;
}>;

interface MenuController {
  items: readonly DropdownMenuItem[];
  open: boolean;
  activeIndex: number;
  setOpen: (open: boolean) => void;
  setActiveIndex: (index: number) => void;
  openAt: (index: number) => void;
  toggle: () => void;
  rootRef: RefObject<HTMLSpanElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  itemRefs: RefObject<(HTMLButtonElement | null)[]>;
}

export function DropdownMenu({
  trigger,
  triggerLabel,
  items,
  align = 'start',
  className,
}: DropdownMenuProps) {
  const menuId = useId();
  const controller = useMenuController(items);
  return (
    <span ref={controller.rootRef} className="relative inline-block">
      <button
        ref={controller.triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={controller.open}
        aria-controls={controller.open ? menuId : undefined}
        aria-label={triggerLabel}
        onClick={controller.toggle}
        onKeyDown={(event) => menuTriggerKeyDown(controller, event)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {controller.open ? (
        <MenuList controller={controller} menuId={menuId} align={align} className={className} />
      ) : null}
    </span>
  );
}

function useMenuController(items: readonly DropdownMenuItem[]): MenuController {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useOutsidePointerDown(rootRef, open, () => setOpen(false));
  useEscapeClose(open, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });
  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);
  const openAt = (index: number) => {
    setActiveIndex(index);
    setOpen(true);
  };
  const toggle = () => {
    if (!open) setActiveIndex(firstEnabledIndex(items.length, (i) => !items[i]?.disabled));
    setOpen(!open);
  };
  return { items, open, activeIndex, setOpen, setActiveIndex, openAt, toggle, rootRef, triggerRef, itemRefs };
}

function menuTriggerKeyDown(
  controller: MenuController,
  event: KeyboardEvent<HTMLButtonElement>,
): void {
  if (event.key === KEYS.ARROW_DOWN) {
    event.preventDefault();
    controller.openAt(firstEnabledIndex(controller.items.length, isEnabled(controller.items)));
  } else if (event.key === KEYS.ARROW_UP) {
    event.preventDefault();
    controller.openAt(lastEnabledIndex(controller.items));
  }
}

function menuListKeyDown(controller: MenuController, event: KeyboardEvent<HTMLDivElement>): void {
  const intent = keyToRovingIntent(event.key, 'vertical');
  if (intent) {
    event.preventDefault();
    controller.setActiveIndex(
      resolveRovingIndex({
        count: controller.items.length,
        current: controller.activeIndex,
        intent,
        isEnabled: isEnabled(controller.items),
      }),
    );
  } else if (event.key === KEYS.TAB) {
    controller.setOpen(false);
  }
}

function selectMenuItem(controller: MenuController, item: DropdownMenuItem): void {
  if (item.disabled) return;
  item.onSelect?.();
  controller.setOpen(false);
  controller.triggerRef.current?.focus();
}

const isEnabled =
  (items: readonly DropdownMenuItem[]) =>
  (index: number): boolean =>
    !items[index]?.disabled;

function lastEnabledIndex(items: readonly DropdownMenuItem[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!items[index]?.disabled) return index;
  }
  return 0;
}

function MenuList({
  controller,
  menuId,
  align,
  className,
}: Readonly<{
  controller: MenuController;
  menuId: string;
  align: 'start' | 'end';
  className?: string | undefined;
}>) {
  const { items, itemRefs, activeIndex } = controller;
  return (
    <div
      role="menu"
      id={menuId}
      onKeyDown={(event) => menuListKeyDown(controller, event)}
      style={{ zIndex: Z_INDEX.dropdown }}
      className={cn(
        'absolute top-full mt-1 min-w-48 rounded-[var(--radius-lg)] border border-[var(--icb-border)]',
        'bg-[var(--icb-surface)] p-1 shadow-[var(--shadow-lg)]',
        align === 'start' ? 'left-0' : 'right-0',
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => selectMenuItem(controller, item)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm',
            'transition-colors disabled:opacity-50',
            item.danger ? 'text-[var(--icb-danger)]' : 'text-[var(--icb-text)]',
            index === activeIndex && 'bg-[var(--icb-bg-muted)]',
          )}
        >
          {item.icon}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
