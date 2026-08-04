import {
  fromDecimalString,
  fromMinorUnits,
  getScale,
  toDecimalString,
  type CurrencyCode,
} from '@icb/money';

/**
 * Masking for {@link MoneyInput}. The draft string the user types is sanitised against the
 * currency scale, and conversion to integer minor units goes through `@icb/money` — a float
 * never touches a money value (agent_plan.md N3).
 */

const NON_AMOUNT_CHARACTERS = /[^\d.]/g;
const LEADING_ZEROS = /^0+(?=\d)/;
const TRAILING_DOT = /\.$/;

/**
 * Reduce free-form input to a valid decimal draft: digits and at most one separator, the
 * fraction capped at the currency scale. Never throws — partial input like `"12."` is a valid
 * mid-typing state and round-trips unchanged.
 */
export function sanitizeMoneyDraft(raw: string, currency: CurrencyCode): string {
  const scale = getScale(currency);
  const negative = raw.trimStart().startsWith('-');
  const cleaned = raw.replace(NON_AMOUNT_CHARACTERS, '');
  const [whole = '', ...fractionParts] = cleaned.split('.');
  const hasSeparator = fractionParts.length > 0 && scale > 0;
  const fraction = fractionParts.join('').slice(0, scale);
  const trimmedWhole = whole.replace(LEADING_ZEROS, '');
  return `${negative ? '-' : ''}${trimmedWhole}${hasSeparator ? '.' : ''}${fraction}`;
}

/** Parse a draft into integer minor units. Returns `null` for empty or incomplete input. */
export function draftToMinorUnits(draft: string, currency: CurrencyCode): number | null {
  const sanitized = sanitizeMoneyDraft(draft, currency).replace(TRAILING_DOT, '');
  if (sanitized === '' || sanitized === '-') {
    return null;
  }
  try {
    return fromDecimalString(sanitized, currency).minorUnits;
  } catch {
    return null;
  }
}

/** Canonical decimal draft for a minor-unit value — used to normalise on blur. */
export function minorUnitsToDraft(minorUnits: number, currency: CurrencyCode): string {
  return toDecimalString(fromMinorUnits(minorUnits, currency));
}
