'use client';

import { useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import {
  filterOptions,
  firstEnabledOptionIndex,
  stepEnabledIndex,
  type ComboOption,
} from './combo-utils';
import { usePopover, type PopoverState } from './use-popover';

export interface ComboboxController {
  readonly popover: PopoverState;
  readonly filtered: ComboOption[];
  readonly activeIndex: number;
  readonly displayValue: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly openList: () => void;
  readonly choose: (option: ComboOption) => void;
  readonly setActiveIndex: (index: number) => void;
  readonly handleQueryChange: (query: string) => void;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * The combobox state machine: query/filtering, the active (highlighted) option, and the APG
 * keyboard contract. Kept out of the component so the render stays declarative and the logic
 * stays under the size/complexity bar.
 */
export function useCombobox(
  options: readonly ComboOption[],
  value: string | null,
  onChange: (value: string | null) => void,
  allowCustomValue: boolean,
): ComboboxController {
  const popover = usePopover();
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => filterOptions(options, query ?? ''), [options, query]);

  const openList = () => {
    popover.openPopover();
    setActiveIndex((current) => (current >= 0 ? current : firstEnabledOptionIndex(filtered)));
  };

  const choose = (option: ComboOption) => {
    if (option.disabled === true) {
      return;
    }
    onChange(option.value);
    setQuery(null);
    popover.closePopover();
    inputRef.current?.focus();
  };

  const commitCustomValue = () => {
    const custom = query?.trim();
    if (allowCustomValue && custom != null && custom !== '') {
      onChange(custom);
      setQuery(null);
      popover.closePopover();
    }
  };

  const handleEnter = () => {
    const active = filtered[activeIndex];
    if (popover.open && active != null) {
      choose(active);
      return;
    }
    commitCustomValue();
  };

  const stepActive = (delta: number) => {
    if (!popover.open) {
      openList();
      return;
    }
    setActiveIndex((current) => stepEnabledIndex(filtered, current, delta));
  };

  const jumpToEdge = (event: KeyboardEvent<HTMLInputElement>, start: boolean) => {
    if (!popover.open) {
      return;
    }
    event.preventDefault();
    setActiveIndex(
      start ? firstEnabledOptionIndex(filtered) : stepEnabledIndex(filtered, filtered.length, -1),
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        stepActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        stepActive(-1);
        break;
      case 'Home':
        jumpToEdge(event, true);
        break;
      case 'End':
        jumpToEdge(event, false);
        break;
      case 'Enter':
        handleEnter();
        break;
      case 'Escape':
        setQuery(null);
        break;
      default:
        break;
    }
  };

  return {
    popover,
    filtered,
    activeIndex,
    displayValue: query ?? selected?.label ?? '',
    inputRef,
    openList,
    choose,
    setActiveIndex,
    handleQueryChange: setQuery,
    handleKeyDown,
  };
}
