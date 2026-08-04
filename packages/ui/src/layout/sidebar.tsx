'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import { cn } from '../lib/cn';
import { IconChevronLeft, IconChevronRight } from '../primitives/icons';
import { firstEnabledIndex, keyToRovingIntent, resolveRovingIndex } from './keyboard';

/**
 * Primary navigation for the dashboard and admin shells.
 *
 * Roving tabindex: the active item (or the first) is in the tab order, ArrowUp/ArrowDown move,
 * Home/End jump, disabled items are skipped. Collapsing narrows to icon-only; labels stay in
 * the accessibility tree via `sr-only`, so the nav never loses its names.
 */
export interface SidebarNavItem {
  id: string;
  label: string;
  href: string;
  icon?: ReactNode;
  /** Marks the current location with `aria-current="page"`. */
  active?: boolean;
  disabled?: boolean;
}

export type SidebarProps = Readonly<{
  items: readonly SidebarNavItem[];
  collapsed?: boolean;
  /** Renders the collapse toggle when provided. */
  onToggleCollapse?: () => void;
  /** Accessible name for the nav landmark. Defaults to "Primary". */
  label?: string;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}>;

export function Sidebar({
  items,
  collapsed = false,
  onToggleCollapse,
  label = 'Primary',
  header,
  footer,
  className,
}: SidebarProps) {
  const roving = useSidebarRoving(items);
  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-e border-[var(--icb-border)] bg-[var(--icb-surface)]',
        'transition-[width] duration-200 ease-[var(--ease-out)]',
        className,
      )}
      style={{ width: collapsed ? 'var(--icb-sidebar-width-collapsed)' : 'var(--icb-sidebar-width)' }}
    >
      {header ? <div className="flex items-center px-4 py-4">{header}</div> : null}
      <nav
        aria-label={label}
        className="flex-1 overflow-y-auto px-2 py-2"
        onKeyDown={roving.onKeyDown}
      >
        <ul className="flex flex-col gap-0.5">
          {items.map((item, index) => (
            <li key={item.id}>
              <SidebarLink
                item={item}
                collapsed={collapsed}
                tabIndex={item.disabled || index !== roving.focusIndex ? -1 : 0}
                linkRef={(el) => {
                  roving.itemRefs.current[index] = el;
                }}
              />
            </li>
          ))}
        </ul>
      </nav>
      {footer ? <div className="border-t border-[var(--icb-border)] px-3 py-3">{footer}</div> : null}
      {onToggleCollapse ? <CollapseToggle collapsed={collapsed} onToggle={onToggleCollapse} /> : null}
    </aside>
  );
}

interface SidebarRoving {
  focusIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  itemRefs: RefObject<(HTMLAnchorElement | null)[]>;
}

function useSidebarRoving(items: readonly SidebarNavItem[]): SidebarRoving {
  const activeIndex = items.findIndex((item) => item.active);
  const [focusIndex, setFocusIndex] = useState(() =>
    activeIndex >= 0 ? activeIndex : firstEnabledIndex(items.length, (i) => !items[i]?.disabled),
  );
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const intent = keyToRovingIntent(event.key, 'vertical');
    if (!intent) return;
    event.preventDefault();
    const target = resolveRovingIndex({
      count: items.length,
      current: focusIndex,
      intent,
      isEnabled: (i) => !items[i]?.disabled,
    });
    setFocusIndex(target);
    itemRefs.current[target]?.focus();
  };
  return { focusIndex, onKeyDown, itemRefs };
}

function CollapseToggle({
  collapsed,
  onToggle,
}: Readonly<{ collapsed: boolean; onToggle: () => void }>) {
  return (
    <div className="border-t border-[var(--icb-border)] px-2 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'flex h-9 w-full items-center justify-center rounded-[var(--radius-md)]',
          'text-[var(--icb-text-subtle)] transition-colors hover:bg-[var(--icb-bg-muted)]',
        )}
      >
        {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
      </button>
    </div>
  );
}

function SidebarLink({
  item,
  collapsed,
  tabIndex,
  linkRef,
}: Readonly<{
  item: SidebarNavItem;
  collapsed: boolean;
  tabIndex: number;
  linkRef: (el: HTMLAnchorElement | null) => void;
}>) {
  return (
    <a
      ref={linkRef}
      href={item.disabled ? undefined : item.href}
      tabIndex={tabIndex}
      aria-current={item.active ? 'page' : undefined}
      aria-disabled={item.disabled || undefined}
      className={cn(
        'flex h-10 items-center gap-3 rounded-[var(--radius-md)] px-3 text-sm font-medium transition-colors',
        item.active
          ? 'bg-[var(--icb-primary-subtle)] text-[var(--icb-primary)]'
          : 'text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]',
        item.disabled && 'pointer-events-none opacity-50',
        collapsed && 'justify-center px-0',
      )}
    >
      {item.icon}
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
    </a>
  );
}
