'use client';

import { cn } from '../lib/cn';
import { useFieldA11y } from './use-field';

export interface SwitchProps {
  readonly value?: boolean;
  readonly onChange?: (value: boolean) => void;
  readonly onBlur?: () => void;
  readonly name?: string;
  readonly size?: 'sm' | 'md';
  readonly disabled?: boolean;
  readonly id?: string;
  readonly className?: string;
}

const TRACK_SIZES = { sm: 'h-5 w-9', md: 'h-6 w-11' } as const;
const THUMB_SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4.5 w-4.5' } as const;
const THUMB_TRAVEL = { sm: 'translate-x-4', md: 'translate-x-5' } as const;

/**
 * An on/off switch with immediate effect — for preferences, not form submissions. It is a
 * `button` with `role="switch"`, so Space and Enter toggle it natively. Controlled via
 * `value`/`onChange` to drop into a RHF `Controller`.
 */
export function Switch({
  value = false,
  onChange,
  onBlur,
  name,
  size = 'md',
  disabled,
  id,
  className,
}: Readonly<SwitchProps>) {
  const a11y = useFieldA11y({ id, disabled });
  return (
    <button
      type="button"
      role="switch"
      id={a11y.id}
      aria-checked={value}
      aria-describedby={a11y.describedBy}
      aria-invalid={a11y.invalid}
      disabled={a11y.disabled}
      data-name={name}
      onClick={() => onChange?.(!value)}
      onBlur={onBlur}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-150',
        'focus-visible:outline-none focus-visible:focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        TRACK_SIZES[size],
        value ? 'bg-[var(--icb-primary)]' : 'bg-[var(--icb-slate-300)]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'rounded-full bg-white shadow-[var(--shadow-xs)] transition-transform duration-150',
          THUMB_SIZES[size],
          value ? THUMB_TRAVEL[size] : 'translate-x-0',
        )}
      />
    </button>
  );
}
