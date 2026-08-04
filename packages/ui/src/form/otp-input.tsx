'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { CONTROL_BASE_CLASSES, CONTROL_INVALID_CLASSES } from './form.constants';
import { DEFAULT_OTP_LENGTH, isCompleteOtp, otpCells, otpFromPaste, setOtpCell } from './otp';
import { useFieldA11y, useFieldState } from './use-field';

export interface OTPInputProps {
  readonly value?: string;
  readonly onChange?: (value: string) => void;
  /** Fired once, when the last missing digit lands. */
  readonly onComplete?: ((value: string) => void) | undefined;
  readonly length?: number;
  readonly name?: string;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
  readonly id?: string;
  readonly className?: string;
}

const CELL_CLASSES =
  'h-12 w-10 p-0 text-center text-lg font-semibold tabular caret-[var(--icb-primary)]';

/**
 * A one-time-code input rendered as per-digit cells. Digits auto-advance, Backspace retreats,
 * arrows move between cells, and a pasted code fans out across all cells. The value is one
 * plain string, matching a RHF `Controller` field.
 */
export function OTPInput({
  value = '',
  onChange,
  onComplete,
  length = DEFAULT_OTP_LENGTH,
  name,
  disabled,
  invalid,
  id,
  className,
}: Readonly<OTPInputProps>) {
  const a11y = useFieldA11y({ id, disabled, invalid });
  const field = useFieldState();
  const cellRefs = useRef<Array<HTMLInputElement | null>>([]);
  const cells = otpCells(value, length);

  const focusCell = (index: number) => {
    const cell = cellRefs.current[Math.max(0, Math.min(index, length - 1))];
    cell?.focus();
    cell?.select();
  };

  const emit = (next: string) => {
    onChange?.(next);
    if (isCompleteOtp(next, length)) {
      onComplete?.(next);
    }
  };

  const handleDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '');
    if (digit === '') {
      return;
    }
    emit(setOtpCell(value, index, digit, length));
    focusCell(index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (cells[index] === '') {
        focusCell(index - 1);
        emit(setOtpCell(value, index - 1, '', length));
      } else {
        emit(setOtpCell(value, index, '', length));
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusCell(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = otpFromPaste(event.clipboardData.getData('text'), length);
    if (pasted === '') {
      return;
    }
    emit(pasted);
    focusCell(Math.min(pasted.length, length - 1));
  };

  return (
    <div
      role="group"
      id={a11y.id}
      aria-labelledby={field?.labelId}
      aria-describedby={a11y.describedBy}
      aria-invalid={a11y.invalid}
      className={cn('flex gap-2', className)}
    >
      {cells.map((cell, index) => (
        <input
          key={index}
          ref={(element) => {
            cellRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${index + 1} of ${length}`}
          value={cell}
          disabled={a11y.disabled}
          onChange={(event) => handleDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          className={cn(
            CONTROL_BASE_CLASSES,
            CELL_CLASSES,
            a11y.invalid === true && CONTROL_INVALID_CLASSES,
          )}
        />
      ))}
      {name != null ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}
