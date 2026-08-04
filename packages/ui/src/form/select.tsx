'use client';

import { type ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { IconChevronDown } from '../primitives/icons';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  type ControlSize,
} from './form.constants';
import { useFieldA11y } from './use-field';

export interface SelectProps extends Omit<ComponentProps<'select'>, 'size'> {
  readonly size?: ControlSize;
  readonly invalid?: boolean;
}

/**
 * A styled native `<select>`. Native deliberately: full keyboard and screen-reader behaviour
 * comes free, and on mobile it hands off to the platform picker. Reach for {@link Combobox}
 * when the option list needs search.
 */
export function Select({
  size = 'md',
  invalid,
  className,
  id,
  disabled,
  required,
  children,
  ...props
}: Readonly<SelectProps>) {
  const a11y = useFieldA11y({
    id,
    invalid,
    disabled,
    required,
    describedBy: props['aria-describedby'],
  });
  return (
    <div className="relative">
      <select
        {...props}
        id={a11y.id}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        className={cn(
          CONTROL_BASE_CLASSES,
          CONTROL_SIZES[size],
          'appearance-none pr-9',
          a11y.invalid === true && CONTROL_INVALID_CLASSES,
          className,
        )}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[var(--icb-text-subtle)]">
        <IconChevronDown size="sm" />
      </span>
    </div>
  );
}
