'use client';

import { type ComponentProps } from 'react';

import { cn } from '../lib/cn';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  type ControlSize,
} from './form.constants';
import { useFieldA11y } from './use-field';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  readonly size?: ControlSize;
  readonly invalid?: boolean;
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
  ...props
}: Readonly<InputProps>) {
  const a11y = useFieldA11y({
    id,
    invalid,
    disabled,
    required,
    describedBy: props['aria-describedby'],
  });
  return (
    <input
      {...props}
      id={a11y.id}
      disabled={a11y.disabled}
      required={a11y.required}
      aria-invalid={a11y.invalid}
      aria-describedby={a11y.describedBy}
      className={cn(
        CONTROL_BASE_CLASSES,
        CONTROL_SIZES[size],
        a11y.invalid === true && CONTROL_INVALID_CLASSES,
        className,
      )}
    />
  );
}
