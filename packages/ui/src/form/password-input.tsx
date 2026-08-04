'use client';

import { useState, type ComponentProps } from 'react';

import { cn } from '../lib/cn';
import { IconEye, IconEyeOff } from '../primitives/icons';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  FORM_COPY,
  type ControlSize,
} from './form.constants';
import { scorePassword, type PasswordStrength } from './password-strength';
import { useFieldA11y } from './use-field';

export interface PasswordInputProps extends Omit<ComponentProps<'input'>, 'size' | 'type'> {
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  /** Renders the live strength meter below the input. Defaults to on. */
  readonly showStrengthMeter?: boolean;
}

/**
 * Password entry with a visibility toggle and an offline strength meter. The meter is a
 * `role="meter"` element, so the score is announced as a value, not just shown as colour.
 */
export function PasswordInput({
  size = 'md',
  invalid,
  showStrengthMeter = true,
  className,
  id,
  disabled,
  required,
  value,
  defaultValue,
  onChange,
  ...props
}: Readonly<PasswordInputProps>) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(String(defaultValue ?? ''));
  const a11y = useFieldA11y({
    id,
    invalid,
    disabled,
    required,
    describedBy: props['aria-describedby'],
  });
  const current = typeof value === 'string' ? value : draft;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          id={a11y.id}
          value={value}
          defaultValue={defaultValue}
          disabled={a11y.disabled}
          required={a11y.required}
          aria-invalid={a11y.invalid}
          aria-describedby={a11y.describedBy}
          onChange={(event) => {
            setDraft(event.target.value);
            onChange?.(event);
          }}
          className={cn(
            CONTROL_BASE_CLASSES,
            CONTROL_SIZES[size],
            'pr-11',
            a11y.invalid === true && CONTROL_INVALID_CLASSES,
            className,
          )}
        />
        <VisibilityToggle
          visible={visible}
          disabled={a11y.disabled}
          onToggle={() => setVisible((shown) => !shown)}
        />
      </div>
      {showStrengthMeter && current.length > 0 ? (
        <StrengthMeter strength={scorePassword(current)} />
      ) : null}
    </div>
  );
}

function VisibilityToggle({
  visible,
  disabled,
  onToggle,
}: Readonly<{ visible: boolean; disabled: boolean | undefined; onToggle: () => void }>) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={visible ? FORM_COPY.hidePassword : FORM_COPY.showPassword}
      aria-pressed={visible}
      disabled={disabled}
      onClick={onToggle}
      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--icb-text-subtle)] transition-colors hover:text-[var(--icb-text)] disabled:opacity-50"
    >
      {visible ? <IconEyeOff size="sm" /> : <IconEye size="sm" />}
    </button>
  );
}

const METER_SEGMENTS = 4;
const METER_TONES = [
  'bg-[var(--icb-danger)]',
  'bg-[var(--icb-danger)]',
  'bg-[var(--icb-warning)]',
  'bg-[var(--icb-success)]',
  'bg-[var(--icb-success)]',
] as const;

function StrengthMeter({ strength }: Readonly<{ strength: PasswordStrength }>) {
  return (
    <div
      role="meter"
      aria-label={FORM_COPY.strengthLabel}
      aria-valuemin={0}
      aria-valuemax={METER_SEGMENTS}
      aria-valuenow={strength.score}
      aria-valuetext={strength.label}
      className="flex items-center gap-2"
    >
      <span aria-hidden="true" className="flex flex-1 gap-1">
        {Array.from({ length: METER_SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full',
              index < strength.score ? METER_TONES[strength.score] : 'bg-[var(--icb-border)]',
            )}
          />
        ))}
      </span>
      <span className="text-xs text-[var(--icb-text-muted)]">{strength.label}</span>
    </div>
  );
}
