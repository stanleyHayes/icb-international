'use client';

import { type ComponentProps, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { IconCheck } from '../primitives/icons';
import { useFieldA11y } from './use-field';

const CHECKBOX_BOX_CLASSES = [
  'relative inline-flex h-5 w-5 shrink-0 items-center justify-center',
  'rounded-[var(--radius-sm)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)]',
  'text-[var(--icb-text-on-brand)] shadow-[var(--shadow-xs)] transition-colors duration-150',
  // The input lives inside this box, so peer-* can never match it — peer targets following
  // siblings. has-* looks the other way, at the descendant input.
  'has-checked:border-[var(--icb-primary)] has-checked:bg-[var(--icb-primary)]',
  'has-focus-visible:focus-ring has-disabled:cursor-not-allowed has-disabled:opacity-50',
  'has-[[aria-invalid=true]]:border-[var(--icb-danger)]',
].join(' ');

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'size'> {
  /** Inline label rendered beside the box — checkboxes label themselves, not via Field. */
  readonly label?: ReactNode;
  readonly invalid?: boolean;
}

/**
 * A checkbox. The real input stays in the DOM (visually transparent over the styled box), so
 * native keyboard, form submission, and `register()` behaviour are all preserved.
 */
export function Checkbox({
  label,
  invalid,
  className,
  id,
  disabled,
  required,
  ...props
}: Readonly<CheckboxProps>) {
  const a11y = useFieldA11y({
    id,
    invalid,
    disabled,
    required,
    describedBy: props['aria-describedby'],
  });
  const box = (
    <span className={CHECKBOX_BOX_CLASSES}>
      <input
        {...props}
        type="checkbox"
        id={a11y.id}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        className={cn('peer absolute inset-0 h-full w-full cursor-pointer opacity-0', className)}
      />
      <IconCheck
        size={14}
        strokeWidth={2.5}
        className="pointer-events-none opacity-0 peer-checked:opacity-100"
      />
    </span>
  );
  if (label == null) {
    return box;
  }
  return (
    <label className="inline-flex cursor-pointer items-start gap-2.5 text-sm text-[var(--icb-text)] has-disabled:cursor-not-allowed has-disabled:opacity-60">
      {box}
      <span className="pt-0.5">{label}</span>
    </label>
  );
}
