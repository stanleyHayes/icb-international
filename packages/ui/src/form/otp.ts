/**
 * Segmentation logic for {@link OTPInput}. The component stores one string value; these pure
 * helpers decide how it spreads across the per-digit cells.
 */

const NON_DIGITS = /\D/g;

export const DEFAULT_OTP_LENGTH = 6;

/** Spread a value across `length` cells — a too-short value pads with empty cells. */
export function otpCells(value: string, length: number): string[] {
  const digits = value.replace(NON_DIGITS, '').slice(0, length);
  return Array.from({ length }, (_, index) => digits.charAt(index));
}

/** Replace the digit at `index`; an empty `digit` deletes it and shifts the tail left. */
export function setOtpCell(value: string, index: number, digit: string, length: number): string {
  const clean = digit.replace(NON_DIGITS, '').charAt(0);
  const head = value.slice(0, index);
  const tail = value.slice(index + 1);
  return clean === '' ? (head + tail).slice(0, length) : (head + clean + tail).slice(0, length);
}

/** Collapse pasted text (spaces, dashes and all) into a plain digit string for the cells. */
export function otpFromPaste(text: string, length: number): string {
  return text.replace(NON_DIGITS, '').slice(0, length);
}

export function isCompleteOtp(value: string, length: number): boolean {
  return value.replace(NON_DIGITS, '').length === length && value.length === length;
}
