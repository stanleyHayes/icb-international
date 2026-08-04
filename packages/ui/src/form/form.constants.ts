/**
 * Shared tokens for the form primitives.
 *
 * Class strings live here so every control shares one border, one focus ring, and one error
 * treatment — a form reads as a single surface, not sixteen unrelated components.
 */

export const FIELD_ID_PARTS = {
  label: 'label',
  description: 'description',
  error: 'error',
} as const;

export const CONTROL_SIZES = {
  sm: 'h-8 px-2.5 text-[0.8125rem]',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
} as const;

export type ControlSize = keyof typeof CONTROL_SIZES;

/** Base chrome for text-like controls (input, textarea, select, combobox trigger). */
export const CONTROL_BASE_CLASSES = [
  'w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)]',
  'bg-[var(--icb-surface)] text-[var(--icb-text)] shadow-[var(--shadow-xs)]',
  'placeholder:text-[var(--icb-text-subtle)]',
  'transition-[border-color,box-shadow] duration-150 ease-[var(--ease-out)]',
  'hover:border-[var(--icb-slate-400)]',
  'focus-visible:outline-none focus-visible:focus-ring-inset',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

/** Applied on top of the base when the field is invalid — the danger border wins over hover. */
export const CONTROL_INVALID_CLASSES =
  'border-[var(--icb-danger)] hover:border-[var(--icb-danger)]';

export const FIELD_LABEL_CLASSES = 'text-sm font-medium text-[var(--icb-text)]';
export const FIELD_DESCRIPTION_CLASSES = 'text-xs text-[var(--icb-text-muted)]';
export const FIELD_ERROR_CLASSES = 'text-xs font-medium text-[var(--icb-danger-fg)]';

/** Floating panel shared by the combobox listbox and the calendar popovers. */
export const POPOVER_PANEL_CLASSES = [
  'absolute z-30 mt-1 rounded-[var(--radius-md)] border border-[var(--icb-border)]',
  'bg-[var(--icb-surface)] shadow-[var(--icb-shadow-lg)]',
].join(' ');

/** Default microcopy, kept in one place so apps can audit every string the kit ships. */
export const FORM_COPY = {
  comboboxEmpty: 'No matches',
  comboboxToggle: 'Toggle options',
  dropzoneHint: 'Drag and drop files here, or press Enter to browse',
  calendarOpen: 'Open calendar',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  strengthLabel: 'Password strength',
} as const;
