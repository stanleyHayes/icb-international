'use client';

import { cn } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useId, type ChangeEvent, type ReactNode } from 'react';

const CONTROL_CLASS =
  'mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]';

/** Form-level failure, e.g. a domain error returned by the API. Announced, never silent. */
export function FormError({ message }: Readonly<{ message: string | null }>) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

export function FieldError({ id, message }: Readonly<{ id: string; message?: string | undefined }>) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
      {message}
    </p>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly name: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly type?: string | undefined;
  readonly inputMode?: 'text' | 'numeric' | 'decimal' | undefined;
  readonly required?: boolean | undefined;
  readonly maxLength?: number | undefined;
  readonly placeholder?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly autoComplete?: string | undefined;
}

/** Labelled text input in the established client-dashboard style. */
export function TextField({
  label,
  name,
  hint,
  error,
  type = 'text',
  inputMode = 'text',
  required = false,
  maxLength,
  placeholder,
  defaultValue,
  autoComplete,
}: TextFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint ? (
          <span className="font-normal text-[var(--icb-text-subtle)]"> {hint}</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL_CLASS}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface Option {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly label: string;
  readonly name: string;
  readonly options: readonly Option[];
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly value?: string | undefined;
  readonly defaultValue?: string | undefined;
  readonly onChange?: ((value: string) => void) | undefined;
}

/** Labelled select, controlled or uncontrolled. */
export function SelectField({
  label,
  name,
  options,
  hint,
  error,
  value,
  defaultValue,
  onChange,
}: SelectFieldProps) {
  const id = useId();
  const controlled = value !== undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint ? (
          <span className="font-normal text-[var(--icb-text-subtle)]"> {hint}</span>
        ) : null}
      </label>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CONTROL_CLASS}
        {...(controlled
          ? { value, onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange?.(event.target.value) }
          : { defaultValue: defaultValue ?? options[0]?.value })}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface MoneyFieldProps {
  readonly label: string;
  readonly name: string;
  readonly currency: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly defaultValue?: string | undefined;
}

/**
 * A decimal money draft. The server action parses it to integer minor units — the float never
 * leaves the text field (agent_plan.md N3).
 */
export function MoneyField({ label, name, currency, hint, error, defaultValue }: MoneyFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint ? (
          <span className="font-normal text-[var(--icb-text-subtle)]"> {hint}</span>
        ) : null}
      </label>
      <div className="relative mt-1.5">
        <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-[var(--icb-text-subtle)]">
          {currency}
        </span>
        <input
          id={id}
          name={name}
          inputMode="decimal"
          placeholder="0.00"
          defaultValue={defaultValue}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="tabular h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] pr-3.5 pl-14 text-right text-lg font-semibold outline-none focus:border-[var(--icb-primary)]"
        />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

interface ToggleRowProps {
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

/** A labelled on/off row, button-based so it is keyboard-complete and announced. */
export function ToggleRow({ label, description, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--icb-primary)] disabled:opacity-50',
          checked ? 'bg-[var(--icb-primary)]' : 'bg-[var(--icb-border-strong)]',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/** Section shell for a labelled group of controls. */
export function FieldGroup({
  legend,
  children,
}: Readonly<{ legend: string; children: ReactNode }>) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2">{children}</div>
    </fieldset>
  );
}
