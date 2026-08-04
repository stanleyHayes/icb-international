import {
  DEFAULT_DIALING_CODES,
  E164_MAX_DIGITS,
  E164_MIN_DIGITS,
  type DialingCode,
} from './phone.constants';

/**
 * Split/join logic for {@link PhoneInput}. The wire value is always E.164 (`+233555123456`);
 * the input shows a calling-code select and a spaced national number.
 */

export interface PhoneParts {
  readonly dialCode: string;
  /** National significant number, digits only (no spacing). */
  readonly national: string;
}

const NON_DIGITS = /\D/g;
const NATIONAL_GROUP = 3;
const NATIONAL_GROUP_MAX_TAIL = 4;

/** Split an E.164-ish value into the matching calling code and the national digits. */
export function splitPhoneNumber(
  value: string,
  codes: readonly DialingCode[] = DEFAULT_DIALING_CODES,
): PhoneParts {
  const digits = value.replace(NON_DIGITS, '');
  // Longest code first so `+1` does not swallow `+1242`-style prefixes.
  const match = [...codes]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((code) => digits.startsWith(code.dialCode));
  if (match == null) {
    return { dialCode: codes[0]?.dialCode ?? '', national: digits };
  }
  return { dialCode: match.dialCode, national: digits.slice(match.dialCode.length) };
}

/** Join calling code + national digits into E.164. Empty national input yields an empty value. */
export function joinPhoneNumber(dialCode: string, national: string): string {
  const digits = national.replace(NON_DIGITS, '');
  return digits === '' ? '' : `+${dialCode}${digits}`;
}

/** Group national digits for display: `5551234567` → `555 123 4567`. */
export function formatNationalNumber(national: string): string {
  const digits = national.replace(NON_DIGITS, '');
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > NATIONAL_GROUP_MAX_TAIL) {
    groups.push(rest.slice(0, NATIONAL_GROUP));
    rest = rest.slice(NATIONAL_GROUP);
  }
  if (rest !== '') {
    groups.push(rest);
  }
  return groups.join(' ');
}

/** Plausibility check only — full validation is the API's job. */
export function isPossiblePhoneNumber(value: string): boolean {
  const digits = value.replace(NON_DIGITS, '');
  return digits.length >= E164_MIN_DIGITS && digits.length <= E164_MAX_DIGITS;
}
