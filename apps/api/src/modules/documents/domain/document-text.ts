import { format, fromMinorUnits, type CurrencyCode } from '@icb/money';

import { slugify } from '@icb/media';

/** Amount with grouping and the currency's full scale, but no symbol — the column is labelled. */
export function formatAmount(minorUnits: number, currency: CurrencyCode): string {
  return format(fromMinorUnits(minorUnits, currency), { display: 'none' });
}

/** Amount qualified by its ISO code, for figures that stand alone in prose. */
export function formatAmountWithCode(minorUnits: number, currency: CurrencyCode): string {
  return `${currency} ${formatAmount(minorUnits, currency)}`;
}

const MINUTE_PRECISION = 16;

/** `2026-08-02 14:30 UTC`. Explicitly UTC, because a statement is a dated legal record. */
export function formatInstant(instant: Date): string {
  return `${instant.toISOString().slice(0, MINUTE_PRECISION).replace('T', ' ')} UTC`;
}

const LAST_DIGITS = 4;
/** U+00B7, which WinAnsiEncoding can represent, so it survives into the PDF unchanged. */
const MASK_CHARACTER = '·';

/** `Everyday Current ····4321` — enough to recognise the account, not enough to quote it. */
export function accountLabelFor(productName: string, accountNumber: string): string {
  return `${productName} ${MASK_CHARACTER.repeat(LAST_DIGITS)}${accountNumber.slice(-LAST_DIGITS)}`;
}

/**
 * `ICB-statement-1234567890-2026-01.pdf`. The reference is slugified, so it is safe on every
 * filesystem and in a URL whether it arrives as a bare account number or as a display label.
 */
export function statementFilename(accountReference: string, period: string): string {
  return `ICB-statement-${slugify(accountReference)}-${period}.pdf`;
}

/** `ICB-balance-confirmation-1234567890.pdf`, derived from the document's own title. */
export function documentFilename(title: string): string {
  return `ICB-${slugify(title)}.pdf`;
}
