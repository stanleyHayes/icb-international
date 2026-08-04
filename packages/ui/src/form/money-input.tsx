'use client';

import { getCurrency, type CurrencyCode } from '@icb/money';
import { useEffect, useRef, useState } from 'react';

import { cn } from '../lib/cn';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  type ControlSize,
} from './form.constants';
import { draftToMinorUnits, minorUnitsToDraft, sanitizeMoneyDraft } from './money-mask';
import { useFieldA11y } from './use-field';

export interface MoneyInputProps {
  /** The value in integer minor units — `null` while the field is empty or incomplete. */
  readonly value: number | null;
  readonly onChange?: (minorUnits: number | null) => void;
  readonly currency: CurrencyCode;
  readonly onBlur?: () => void;
  readonly name?: string;
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly id?: string;
  readonly className?: string;
}

/**
 * A masked money input. The user types a decimal draft; the form value is always integer minor
 * units produced by `@icb/money`, so no float ever stands in for an amount (N3). The draft is
 * normalised to the currency's canonical scale on blur.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  onBlur,
  name,
  size = 'md',
  invalid,
  placeholder,
  disabled,
  required,
  id,
  className,
}: Readonly<MoneyInputProps>) {
  const [draft, setDraft] = useState(() => (value == null ? '' : minorUnitsToDraft(value, currency)));
  const a11y = useFieldA11y({ id, invalid, disabled, required });
  const focused = useRef(false);

  // External value changes replace the draft, but a parent that never echoes `onChange` back
  // (uncontrolled use) or one echoing on every keystroke (RHF) must not clobber typing.
  const previous = useRef({ value, currency });
  useEffect(() => {
    const currencyChanged = previous.current.currency !== currency;
    const valueChanged = previous.current.value !== value;
    previous.current = { value, currency };
    if (currencyChanged || (valueChanged && !focused.current)) {
      setDraft(value == null ? '' : minorUnitsToDraft(value, currency));
    }
  }, [value, currency]);

  const handleChange = (raw: string) => {
    const sanitized = sanitizeMoneyDraft(raw, currency);
    setDraft(sanitized);
    onChange?.(draftToMinorUnits(sanitized, currency));
  };

  const handleBlur = () => {
    focused.current = false;
    const minor = draftToMinorUnits(draft, currency);
    setDraft(minor == null ? '' : minorUnitsToDraft(minor, currency));
    onBlur?.();
  };

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[var(--icb-text-subtle)]"
      >
        {getCurrency(currency).symbol}
      </span>
      <input
        type="text"
        inputMode="decimal"
        id={a11y.id}
        name={name}
        value={draft}
        placeholder={placeholder}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={handleBlur}
        className={cn(
          CONTROL_BASE_CLASSES,
          CONTROL_SIZES[size],
          'tabular pl-9',
          a11y.invalid === true && CONTROL_INVALID_CLASSES,
          className,
        )}
      />
    </div>
  );
}
