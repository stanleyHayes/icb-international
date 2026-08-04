/**
 * Filtering and active-option navigation for {@link Combobox}, pure so the keyboard walk is
 * testable without rendering a listbox.
 */

export interface ComboOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

const NO_ACTIVE = -1;

/** Case-insensitive substring match on the label; an empty query keeps every option. */
export function filterOptions(options: readonly ComboOption[], query: string): ComboOption[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [...options];
  }
  return options.filter((option) => option.label.toLowerCase().includes(needle));
}

/** First enabled option, used when the list opens with nothing highlighted yet. */
export function firstEnabledOptionIndex(options: readonly ComboOption[]): number {
  return options.findIndex((option) => !option.disabled);
}

/**
 * Move the active option by `delta`, skipping disabled options and wrapping at both ends.
 * Returns {@link NO_ACTIVE} when every option is disabled or the list is empty.
 */
export function stepEnabledIndex(
  options: readonly ComboOption[],
  from: number,
  delta: number,
): number {
  if (options.length === 0 || options.every((option) => option.disabled)) {
    return NO_ACTIVE;
  }
  let next = from;
  for (let steps = 0; steps < options.length; steps += 1) {
    next = (next + delta + options.length) % options.length;
    if (!options[next]?.disabled) {
      return next;
    }
  }
  return NO_ACTIVE;
}
