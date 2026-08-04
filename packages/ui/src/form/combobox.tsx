'use client';

import { cn } from '../lib/cn';
import { IconCheck, IconChevronDown } from '../primitives/icons';
import { type ComboOption } from './combo-utils';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  FORM_COPY,
  POPOVER_PANEL_CLASSES,
  type ControlSize,
} from './form.constants';
import { useCombobox } from './use-combobox';
import { useFieldA11y } from './use-field';

export type { ComboOption } from './combo-utils';

export interface ComboboxProps {
  readonly options: readonly ComboOption[];
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly onBlur?: () => void;
  readonly name?: string;
  readonly placeholder?: string;
  readonly emptyMessage?: string;
  /** When true, Enter commits free text that matches no option. */
  readonly allowCustomValue?: boolean;
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly id?: string;
  readonly className?: string;
}

/**
 * A searchable single-select following the APG combobox pattern: the input keeps focus, the
 * listbox is navigated with arrows (disabled options skipped), Enter selects, Escape closes,
 * and `aria-activedescendant` tracks the highlighted option for screen readers.
 */
export function Combobox({
  options,
  value,
  onChange,
  onBlur,
  name,
  placeholder,
  emptyMessage,
  allowCustomValue = false,
  size = 'md',
  invalid,
  disabled,
  required,
  id,
  className,
}: Readonly<ComboboxProps>) {
  const a11y = useFieldA11y({ id, invalid, disabled, required });
  const combo = useCombobox(options, value, onChange, allowCustomValue);
  const listboxId = `${a11y.id}-listbox`;
  const activeOptionId = activeDescendant(combo.popover.open, combo.activeIndex, a11y.id);

  return (
    <div ref={combo.popover.containerRef} className={cn('relative', className)}>
      <input
        ref={combo.inputRef}
        type="text"
        role="combobox"
        aria-expanded={combo.popover.open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        id={a11y.id}
        value={combo.displayValue}
        placeholder={placeholder}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        onChange={(event) => {
          combo.handleQueryChange(event.target.value);
          combo.openList();
        }}
        onFocus={combo.openList}
        onKeyDown={combo.handleKeyDown}
        onBlur={onBlur}
        className={cn(
          CONTROL_BASE_CLASSES,
          CONTROL_SIZES[size],
          'pr-9',
          a11y.invalid === true && CONTROL_INVALID_CLASSES,
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={FORM_COPY.comboboxToggle}
        disabled={a11y.disabled}
        onClick={() => {
          combo.popover.togglePopover();
          combo.inputRef.current?.focus();
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[var(--icb-text-subtle)] disabled:opacity-50"
      >
        <IconChevronDown size="sm" />
      </button>
      {combo.popover.open ? (
        <ul
          role="listbox"
          id={listboxId}
          className={cn(POPOVER_PANEL_CLASSES, 'max-h-60 w-full overflow-auto py-1')}
        >
          {combo.filtered.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-sm text-[var(--icb-text-subtle)]">
              {emptyMessage ?? FORM_COPY.comboboxEmpty}
            </li>
          ) : (
            combo.filtered.map((option, index) => (
              <ComboRow
                key={option.value}
                option={option}
                index={index}
                idPrefix={a11y.id}
                active={index === combo.activeIndex}
                selected={value === option.value}
                onChoose={combo.choose}
                onHover={combo.setActiveIndex}
              />
            ))
          )}
        </ul>
      ) : null}
      {name != null ? <input type="hidden" name={name} value={value ?? ''} /> : null}
    </div>
  );
}

function activeDescendant(open: boolean, activeIndex: number, idPrefix: string): string | undefined {
  return open && activeIndex >= 0 ? `${idPrefix}-option-${activeIndex}` : undefined;
}

interface ComboRowProps {
  readonly option: ComboOption;
  readonly index: number;
  readonly idPrefix: string;
  readonly active: boolean;
  readonly selected: boolean;
  readonly onChoose: (option: ComboOption) => void;
  readonly onHover: (index: number) => void;
}

function ComboRow({
  option,
  index,
  idPrefix,
  active,
  selected,
  onChoose,
  onHover,
}: Readonly<ComboRowProps>) {
  return (
    <li
      role="option"
      id={`${idPrefix}-option-${index}`}
      aria-selected={selected}
      aria-disabled={option.disabled === true || undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onChoose(option)}
      onMouseMove={() => onHover(index)}
      className={cn(
        'flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm text-[var(--icb-text)]',
        active && 'bg-[var(--icb-bg-muted)]',
        option.disabled === true && 'cursor-not-allowed opacity-50',
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{option.label}</span>
        {option.description != null ? (
          <span className="truncate text-xs text-[var(--icb-text-muted)]">{option.description}</span>
        ) : null}
      </span>
      {selected ? <IconCheck size="sm" className="shrink-0 text-[var(--icb-primary)]" /> : null}
    </li>
  );
}
