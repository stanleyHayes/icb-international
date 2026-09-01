'use client';

import { useState } from 'react';

import { cn } from '../lib/cn';
import { useFieldA11y, useFieldState } from './use-field';

export interface RadioOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface RadioGroupProps {
  readonly options: readonly RadioOption[];
  readonly value?: string | null;
  readonly defaultValue?: string;
  readonly onChange?: (value: string) => void;
  readonly onBlur?: () => void;
  readonly name?: string;
  readonly orientation?: 'vertical' | 'horizontal';
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}

const RADIO_BOX_CLASSES = [
  'relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
  'border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] shadow-[var(--shadow-xs)]',
  // The input lives inside this box, so peer-* can never match it — peer targets following
  // siblings. has-* looks the other way, at the descendant input.
  'transition-colors duration-150 has-checked:border-[var(--icb-primary)]',
  'has-focus-visible:focus-ring has-disabled:cursor-not-allowed has-disabled:opacity-50',
].join(' ');

const RADIO_DOT_CLASSES =
  'h-2.5 w-2.5 rounded-full bg-[var(--icb-primary)] opacity-0 peer-checked:opacity-100';

/**
 * A group of native radios — same `name`, so arrow-key movement between options is the
 * browser's own behaviour. Controlled via `value`/`onChange`, matching a RHF `Controller`.
 */
export function RadioGroup({
  options,
  value,
  defaultValue,
  onChange,
  onBlur,
  name,
  orientation = 'vertical',
  disabled,
  id,
  className,
}: Readonly<RadioGroupProps>) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
  const a11y = useFieldA11y({ id, disabled });
  const field = useFieldState();
  const selectedValue = value ?? uncontrolledValue;
  return (
    <div
      role="radiogroup"
      id={a11y.id}
      aria-labelledby={field?.labelId}
      aria-describedby={a11y.describedBy}
      aria-invalid={a11y.invalid}
      className={cn(
        'flex gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
        className,
      )}
    >
      {options.map((option) => (
        <RadioItem
          key={option.value}
          option={option}
          name={name ?? a11y.id}
          checked={selectedValue === option.value}
          groupDisabled={a11y.disabled}
          onSelect={() => {
            setUncontrolledValue(option.value);
            onChange?.(option.value);
          }}
          onBlur={onBlur}
        />
      ))}
    </div>
  );
}

interface RadioItemProps {
  readonly option: RadioOption;
  readonly name: string;
  readonly checked: boolean;
  readonly groupDisabled: boolean | undefined;
  readonly onSelect: () => void;
  readonly onBlur?: (() => void) | undefined;
}

function RadioItem({ option, name, checked, groupDisabled, onSelect, onBlur }: RadioItemProps) {
  return (
    <label className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-[var(--icb-text)] has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <span className={RADIO_BOX_CLASSES}>
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={checked}
          disabled={groupDisabled === true || option.disabled === true}
          onChange={onSelect}
          onBlur={onBlur}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span aria-hidden="true" className={cn(RADIO_DOT_CLASSES, 'pointer-events-none')} />
      </span>
      <span className="flex flex-col">
        <span>{option.label}</span>
        {option.description != null ? (
          <span className="text-xs text-[var(--icb-text-muted)]">{option.description}</span>
        ) : null}
      </span>
    </label>
  );
}
