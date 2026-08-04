'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import { cn } from '../lib/cn';
import { keyToRovingIntent, resolveRovingIndex } from './keyboard';

/**
 * Tabbed views within a page.
 *
 * Follows the ARIA tabs pattern with automatic activation: arrow keys (matching the
 * orientation) move focus *and* select, Home/End jump, disabled tabs are skipped. Only the
 * selected tab is in the tab order. Controlled via `activeId`/`onChange`, or uncontrolled
 * with `defaultActiveId`.
 */
export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
  panel: ReactNode;
}

export type TabsProps = Readonly<{
  tabs: readonly TabItem[];
  activeId?: string;
  defaultActiveId?: string;
  onChange?: (id: string) => void;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}>;

export function Tabs({ orientation = 'horizontal', className, ...props }: TabsProps) {
  const baseId = useId();
  const { selectedId, select } = useTabsSelection(props);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = resolveTabKeyTarget(props.tabs, selectedId, event.key, orientation);
    if (target < 0) return;
    event.preventDefault();
    const tab = props.tabs[target];
    if (!tab) return;
    select(tab.id);
    tabRefs.current[target]?.focus();
  };
  const selected = props.tabs.find((tab) => tab.id === selectedId);
  return (
    <div className={cn(orientation === 'vertical' && 'flex gap-6', className)}>
      <TabsList
        tabs={props.tabs}
        baseId={baseId}
        selectedId={selectedId}
        orientation={orientation}
        onSelect={select}
        onKeyDown={onKeyDown}
        tabRefs={tabRefs}
      />
      {selected ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${selected.id}`}
          aria-labelledby={`${baseId}-tab-${selected.id}`}
          tabIndex={0}
          className={cn('min-w-0 flex-1', orientation === 'horizontal' ? 'pt-4' : 'pt-0')}
        >
          {selected.panel}
        </div>
      ) : null}
    </div>
  );
}

function useTabsSelection({ tabs, activeId, defaultActiveId, onChange }: TabsProps) {
  const [internalId, setInternalId] = useState(
    () => defaultActiveId ?? tabs.find((tab) => !tab.disabled)?.id ?? '',
  );
  const selectedId = activeId ?? internalId;
  const select = (id: string) => {
    if (activeId === undefined) setInternalId(id);
    onChange?.(id);
  };
  return { selectedId, select };
}

function resolveTabKeyTarget(
  tabs: readonly TabItem[],
  selectedId: string,
  key: string,
  orientation: 'horizontal' | 'vertical',
): number {
  const intent = keyToRovingIntent(key, orientation);
  if (!intent) return -1;
  const current = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selectedId),
  );
  return resolveRovingIndex({
    count: tabs.length,
    current,
    intent,
    isEnabled: (i) => !tabs[i]?.disabled,
  });
}

function TabsList({
  tabs,
  baseId,
  selectedId,
  orientation,
  onSelect,
  onKeyDown,
  tabRefs,
}: Readonly<{
  tabs: readonly TabItem[];
  baseId: string;
  selectedId: string;
  orientation: 'horizontal' | 'vertical';
  onSelect: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  tabRefs: RefObject<(HTMLButtonElement | null)[]>;
}>) {
  const refs = tabRefs;
  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={onKeyDown}
      className={cn(
        'flex gap-1',
        orientation === 'horizontal'
          ? 'border-b border-[var(--icb-border)]'
          : 'min-w-40 flex-col border-e border-[var(--icb-border)]',
      )}
    >
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.id}
          tab={tab}
          baseId={baseId}
          selected={tab.id === selectedId}
          orientation={orientation}
          onSelect={onSelect}
          buttonRef={(el) => {
            refs.current[index] = el;
          }}
        />
      ))}
    </div>
  );
}

function TabButton({
  tab,
  baseId,
  selected,
  orientation,
  onSelect,
  buttonRef,
}: Readonly<{
  tab: TabItem;
  baseId: string;
  selected: boolean;
  orientation: 'horizontal' | 'vertical';
  onSelect: (id: string) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}>) {
  const edge = orientation === 'horizontal' ? 'border-b-2 -mb-px' : 'border-s-2 -ms-px';
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={`${baseId}-tab-${tab.id}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${tab.id}`}
      disabled={tab.disabled}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(tab.id)}
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50',
        edge,
        selected
          ? 'border-[var(--icb-primary)] text-[var(--icb-primary)]'
          : 'border-transparent text-[var(--icb-text-muted)] hover:text-[var(--icb-text)]',
      )}
    >
      {tab.label}
    </button>
  );
}
