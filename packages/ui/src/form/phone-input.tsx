'use client';

import { cn } from '../lib/cn';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  type ControlSize,
} from './form.constants';
import { formatNationalNumber, joinPhoneNumber, splitPhoneNumber } from './phone';
import { DEFAULT_DIALING_CODES, type DialingCode } from './phone.constants';
import { useFieldA11y } from './use-field';

export interface PhoneInputProps {
  /** E.164 value (`+233555123456`), or an empty string when no national number is entered. */
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  readonly onBlur?: () => void;
  readonly name?: string;
  /** Calling codes to offer; defaults to {@link DEFAULT_DIALING_CODES}. */
  readonly codes?: readonly DialingCode[];
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly id?: string;
  readonly className?: string;
}

/**
 * Phone entry as calling-code select + national number input. Both halves are native elements
 * (keyboard-complete by default); the composed value is always E.164 for the API.
 */
export function PhoneInput({
  value = '',
  onChange,
  onBlur,
  name,
  codes = DEFAULT_DIALING_CODES,
  size = 'md',
  invalid,
  disabled,
  required,
  id,
  className,
}: Readonly<PhoneInputProps>) {
  const a11y = useFieldA11y({ id, invalid, disabled, required });
  const parts = splitPhoneNumber(value, codes);

  const controlClasses = cn(
    CONTROL_BASE_CLASSES,
    CONTROL_SIZES[size],
    a11y.invalid === true && CONTROL_INVALID_CLASSES,
  );

  return (
    <div className={cn('flex gap-2', className)}>
      <select
        aria-label="Country calling code"
        aria-invalid={a11y.invalid}
        disabled={a11y.disabled}
        value={parts.dialCode}
        onChange={(event) => onChange?.(joinPhoneNumber(event.target.value, parts.national))}
        className={cn(controlClasses, 'w-auto appearance-none pr-8')}
      >
        {codes.map((code) => (
          <option key={`${code.iso}-${code.dialCode}`} value={code.dialCode}>
            {`${code.iso} +${code.dialCode}`}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        id={a11y.id}
        name={name}
        value={formatNationalNumber(parts.national)}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        onChange={(event) => onChange?.(joinPhoneNumber(parts.dialCode, event.target.value))}
        onBlur={onBlur}
        className={cn(controlClasses, 'tabular flex-1')}
      />
    </div>
  );
}
