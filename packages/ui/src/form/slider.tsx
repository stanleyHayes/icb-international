'use client';

import { useState } from 'react';

import { cn } from '../lib/cn';
import { useFieldA11y } from './use-field';

export interface SliderProps {
  readonly value?: number;
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly onChange?: (value: number) => void;
  readonly onBlur?: () => void;
  readonly name?: string;
  /** Formats the bubble next to the track, e.g. a currency amount. */
  readonly formatValue?: (value: number) => string;
  readonly showValue?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

function defaultFormat(value: number): string {
  return String(value);
}

/**
 * A numeric slider over the native range input, so arrow keys, Home/End, and PageUp/Down all
 * work without custom key handling. Works controlled (`value`) or uncontrolled
 * (`defaultValue`), so both `Controller` and casual use are supported.
 */
export function Slider({
  value,
  defaultValue,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  step = 1,
  onChange,
  onBlur,
  name,
  formatValue = defaultFormat,
  showValue = true,
  disabled,
  id,
  className,
}: Readonly<SliderProps>) {
  const [internal, setInternal] = useState(defaultValue ?? min);
  const current = value ?? internal;
  const a11y = useFieldA11y({ id, disabled });

  const handleChange = (next: number) => {
    if (value === undefined) {
      setInternal(next);
    }
    onChange?.(next);
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <input
        type="range"
        id={a11y.id}
        name={name}
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={a11y.disabled}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y.invalid}
        onChange={(event) => handleChange(Number(event.target.value))}
        onBlur={onBlur}
        className={cn(
          'flex-1 accent-[var(--icb-primary)]',
          'focus-visible:outline-none focus-visible:focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
      {showValue ? (
        <output
          htmlFor={a11y.id}
          className="tabular min-w-10 text-right text-sm font-medium text-[var(--icb-text)]"
        >
          {formatValue(current)}
        </output>
      ) : null}
    </div>
  );
}
