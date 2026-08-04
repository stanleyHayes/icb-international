/**
 * Keyboard interaction primitives.
 *
 * Sidebar, Tabs, DropdownMenu, and CommandPalette all implement the same roving-focus pattern
 * (WAI-ARIA): arrow keys move, Home/End jump, disabled entries are skipped. The movement maths
 * lives here once, pure and unit-tested; components only wire it to refs and state.
 */

/** `KeyboardEvent.key` values used across the layout components. */
export const KEYS = {
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
} as const;

/** What a navigation key asks the focus ring to do. */
export type RovingIntent = 'next' | 'previous' | 'first' | 'last';

/** Which arrow keys a widget listens to. */
export type RovingAxis = 'horizontal' | 'vertical' | 'both';

/** Map a key press to a movement intent for the given axis; `null` means "not a nav key". */
export function keyToRovingIntent(key: string, axis: RovingAxis): RovingIntent | null {
  if (key === KEYS.HOME) return 'first';
  if (key === KEYS.END) return 'last';
  return arrowIntent(key, axis);
}

function arrowIntent(key: string, axis: RovingAxis): RovingIntent | null {
  if (axis !== 'horizontal') {
    if (key === KEYS.ARROW_DOWN) return 'next';
    if (key === KEYS.ARROW_UP) return 'previous';
  }
  if (axis !== 'vertical') {
    if (key === KEYS.ARROW_RIGHT) return 'next';
    if (key === KEYS.ARROW_LEFT) return 'previous';
  }
  return null;
}

export interface RovingOptions {
  /** Total number of focusable slots, including disabled ones. */
  count: number;
  /** Currently focused index. */
  current: number;
  intent: RovingIntent;
  /** Wrap past the ends (menus, tabs). Defaults to `true`. */
  wrap?: boolean;
  /** Disabled slots are skipped. Defaults to "everything enabled". */
  isEnabled?: (index: number) => boolean;
}

const ALWAYS_ENABLED = (): boolean => true;

/** Resolve the index focus should move to, skipping disabled slots in the direction of travel. */
export function resolveRovingIndex(options: RovingOptions): number {
  const { count, current, intent, wrap = true, isEnabled = ALWAYS_ENABLED } = options;
  if (count <= 0) return 0;
  const step = intent === 'previous' ? -1 : 1;
  let index = clampIndex(rawIndex(count, current, intent), count, wrap);
  for (let visited = 0; visited < count && !isEnabled(index); visited += 1) {
    index = clampIndex(index + step, count, wrap);
  }
  return isEnabled(index) ? index : current;
}

function rawIndex(count: number, current: number, intent: RovingIntent): number {
  switch (intent) {
    case 'first':
      return 0;
    case 'last':
      return count - 1;
    case 'next':
      return current + 1;
    case 'previous':
      return current - 1;
  }
}

function clampIndex(index: number, count: number, wrap: boolean): number {
  if (wrap) return ((index % count) + count) % count;
  return Math.min(Math.max(index, 0), count - 1);
}

/** Index of the first enabled slot, or 0 when everything is disabled/empty. */
export function firstEnabledIndex(count: number, isEnabled: (index: number) => boolean): number {
  for (let index = 0; index < count; index += 1) {
    if (isEnabled(index)) return index;
  }
  return 0;
}
