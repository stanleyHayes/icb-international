'use client';

import { type ComponentProps, type ReactNode } from 'react';
import { Clock3 } from 'lucide-react';

import { cn } from '../lib/cn';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  type ControlSize,
} from './form.constants';
import { useFieldA11y } from './use-field';
import { CalendarGlyph } from './calendar';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  /** Decorative context shown inside the leading edge of the control. */
  readonly startIcon?: ReactNode;
  /** Decorative context shown inside the trailing edge of the control. */
  readonly endIcon?: ReactNode;
}

function isPickerType(type: InputProps['type']) {
  return type === 'date' || type === 'datetime-local' || type === 'time';
}

function pickerIcon(type: InputProps['type']) {
  if (type === 'date' || type === 'datetime-local') return <CalendarGlyph />;
  if (type === 'time') return <Clock3 size={16} />;
  return null;
}

function inputClasses({
  size,
  hasStartIcon,
  hasEndIcon,
  pickerType,
  invalid,
  className,
}: Readonly<{
  size: ControlSize;
  hasStartIcon: boolean;
  hasEndIcon: boolean;
  pickerType: boolean;
  invalid: boolean;
  className: string | undefined;
}>) {
  return cn(
    CONTROL_BASE_CLASSES,
    CONTROL_SIZES[size],
    hasStartIcon && 'pl-10',
    hasEndIcon && 'pr-10',
    pickerType &&
      'appearance-none tabular [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
    invalid && CONTROL_INVALID_CLASSES,
    className,
  );
}

/**
 * The text input. A native element, so `register('field')` from react-hook-form spreads
 * straight onto it — `name`, `onChange`, `onBlur`, and `ref` all land where RHF expects them.
 */
export function Input({
  size = 'md',
  invalid,
  className,
  id,
  disabled,
  required,
  startIcon,
  endIcon,
  type,
  ...props
}: Readonly<InputProps>) {
  const a11y = useFieldA11y({
    id,
    invalid,
    disabled,
    required,
    describedBy: props['aria-describedby'],
  });
  const pickerType = isPickerType(type);
  const resolvedEndIcon = endIcon ?? pickerIcon(type);
  const control = (
    <input
      {...props}
      type={type}
      id={a11y.id}
      disabled={a11y.disabled}
      required={a11y.required}
      aria-invalid={a11y.invalid}
      aria-describedby={a11y.describedBy}
      className={inputClasses({
        size,
        hasStartIcon: Boolean(startIcon),
        hasEndIcon: Boolean(resolvedEndIcon),
        pickerType,
        invalid: a11y.invalid === true,
        className,
      })}
    />
  );

  if (!startIcon && !resolvedEndIcon) return control;

  return (
    <span className="relative block">
      {startIcon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-[var(--icb-text-subtle)]"
        >
          {startIcon}
        </span>
      ) : null}
      {control}
      {resolvedEndIcon ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 z-10 flex items-center text-[var(--icb-text-subtle)]"
        >
          {resolvedEndIcon}
        </span>
      ) : null}
    </span>
  );
}
