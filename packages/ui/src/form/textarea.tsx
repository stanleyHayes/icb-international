'use client';

import { type ComponentProps } from 'react';

import { cn } from '../lib/cn';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  type ControlSize,
} from './form.constants';
import { useFieldA11y } from './use-field';

const TEXTAREA_SIZES: Readonly<Record<ControlSize, string>> = {
  sm: 'min-h-16 px-2.5 py-1.5 text-[0.8125rem]',
  md: 'min-h-20 px-3 py-2 text-sm',
  lg: 'min-h-28 px-4 py-3 text-base',
};

export interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'size'> {
  readonly size?: ControlSize;
  readonly invalid?: boolean;
}

/** Multi-line text. Sized by minimum height so users can always resize taller. */
export function Textarea({
  size = 'md',
  invalid,
  className,
  id,
  disabled,
  required,
  rows = 3,
  ...props
}: Readonly<TextareaProps>) {
  const a11y = useFieldA11y({
    id,
    invalid,
    disabled,
    required,
    describedBy: props['aria-describedby'],
  });
  return (
    <textarea
      {...props}
      id={a11y.id}
      rows={rows}
      disabled={a11y.disabled}
      required={a11y.required}
      aria-invalid={a11y.invalid}
      aria-describedby={a11y.describedBy}
      className={cn(
        CONTROL_BASE_CLASSES,
        TEXTAREA_SIZES[size],
        a11y.invalid === true && CONTROL_INVALID_CLASSES,
        className,
      )}
    />
  );
}
