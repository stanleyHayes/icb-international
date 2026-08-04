'use client';

import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { IconSearch } from '../primitives/icons';
import { filterCommands, groupCommands, type FilterableCommand } from './command-filter';
import { KEYS, keyToRovingIntent, resolveRovingIndex } from './keyboard';
import { OverlayFrame } from './overlay-frame';

/**
 * The ⌘K surface: fuzzy-find any action or destination. The input keeps focus and uses the
 * `aria-activedescendant` combobox pattern — arrows move the active option, Enter runs it,
 * Home/End jump, Escape closes (via the frame). Filtering/ranking lives in
 * `command-filter.ts`, pure and tested.
 */
export interface CommandItem extends FilterableCommand {
  icon?: ReactNode;
  /** Rendered as a keyboard hint, e.g. "⌘T". */
  shortcut?: string;
  onSelect?: () => void;
}

export type CommandPaletteProps = Readonly<{
  open: boolean;
  onClose: () => void;
  commands: readonly CommandItem[];
  placeholder?: string;
  emptyMessage?: string;
}>;

export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = 'Type a command or search…',
  emptyMessage = 'No results found.',
}: CommandPaletteProps) {
  const listId = useId();
  const palette = usePaletteController(commands, onClose);
  if (!open) return null;
  const activeCommand = palette.filtered[palette.active];
  return (
    <OverlayFrame
      onClose={onClose}
      wrapperClassName="flex justify-center overflow-y-auto p-4"
      className="relative mt-[15vh] h-fit w-full max-w-xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--icb-border)] bg-[var(--icb-surface)] shadow-[var(--shadow-xl)]"
    >
      <PaletteInput
        query={palette.query}
        placeholder={placeholder}
        listId={listId}
        activeOptionId={activeCommand ? optionId(listId, activeCommand) : undefined}
        onQueryChange={palette.onQueryChange}
        onKeyDown={palette.onKeyDown}
      />
      <PaletteResults
        filtered={palette.filtered}
        activeId={activeCommand?.id}
        listId={listId}
        emptyMessage={emptyMessage}
        onHover={palette.setActiveIndex}
        onRun={palette.run}
      />
    </OverlayFrame>
  );
}

interface PaletteController {
  query: string;
  filtered: CommandItem[];
  active: number;
  setActiveIndex: (index: number) => void;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  run: (command: CommandItem | undefined) => void;
}

function usePaletteController(
  commands: readonly CommandItem[],
  onClose: () => void,
): PaletteController {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = filterCommands(commands, query);
  const active = Math.min(activeIndex, Math.max(0, filtered.length - 1));
  const run = (command: CommandItem | undefined) => {
    if (!command) return;
    command.onSelect?.();
    onClose();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const intent = keyToRovingIntent(event.key, 'vertical');
    if (intent) {
      event.preventDefault();
      setActiveIndex(resolveRovingIndex({ count: filtered.length, current: active, intent }));
    } else if (event.key === KEYS.ENTER) {
      event.preventDefault();
      run(filtered[active]);
    }
  };
  const onQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
  };
  return { query, filtered, active, setActiveIndex, onQueryChange, onKeyDown, run };
}

function optionId(listId: string, command: FilterableCommand): string {
  return `${listId}-option-${command.id}`;
}

function PaletteInput({
  query,
  placeholder,
  listId,
  activeOptionId,
  onQueryChange,
  onKeyDown,
}: Readonly<{
  query: string;
  placeholder: string;
  listId: string;
  activeOptionId: string | undefined;
  onQueryChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}>) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--icb-border)] px-4">
      <IconSearch className="text-[var(--icb-text-subtle)]" />
      <input
        // The palette exists for keyboard input; focus belongs in the field on open.
        autoFocus
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--icb-text-subtle)]"
      />
      <kbd className="rounded-[var(--radius-xs)] border border-[var(--icb-border)] bg-[var(--icb-bg-muted)] px-1.5 py-0.5 text-[0.6875rem] text-[var(--icb-text-subtle)]">
        esc
      </kbd>
    </div>
  );
}

function PaletteResults({
  filtered,
  activeId,
  listId,
  emptyMessage,
  onHover,
  onRun,
}: Readonly<{
  filtered: CommandItem[];
  activeId: string | undefined;
  listId: string;
  emptyMessage: string;
  onHover: (index: number) => void;
  onRun: (command: CommandItem) => void;
}>) {
  if (filtered.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-[var(--icb-text-muted)]">{emptyMessage}</p>
    );
  }
  return (
    <div className="max-h-80 overflow-y-auto p-2">
      <ul role="listbox" id={listId} aria-label="Commands">
        {groupCommands(filtered).map(({ group, items }) => (
          <li key={group ?? 'ungrouped'} role="presentation">
            {group ? (
              <div
                role="presentation"
                className="px-3 pt-3 pb-1 text-xs font-medium tracking-wide text-[var(--icb-text-subtle)] uppercase"
              >
                {group}
              </div>
            ) : null}
            <ul role="presentation">
              {items.map((command) => {
                const index = filtered.findIndex((candidate) => candidate.id === command.id);
                return (
                  <CommandOption
                    key={command.id}
                    command={command}
                    id={optionId(listId, command)}
                    active={command.id === activeId}
                    onHover={() => onHover(index)}
                    onRun={() => onRun(command)}
                  />
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommandOption({
  command,
  id,
  active,
  onHover,
  onRun,
}: Readonly<{
  command: CommandItem;
  id: string;
  active: boolean;
  onHover: () => void;
  onRun: () => void;
}>) {
  return (
    <li
      role="option"
      id={id}
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onRun}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm',
        active
          ? 'bg-[var(--icb-primary-subtle)] text-[var(--icb-primary)]'
          : 'text-[var(--icb-text)]',
      )}
    >
      {command.icon}
      <span className="min-w-0 flex-1 truncate">{command.label}</span>
      {command.shortcut ? (
        <kbd className="text-xs text-[var(--icb-text-subtle)]">{command.shortcut}</kbd>
      ) : null}
    </li>
  );
}
