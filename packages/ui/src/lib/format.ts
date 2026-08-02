import { format, formatParts, fromMinorUnits, type CurrencyCode } from '@icb/money';

export interface MoneyLike {
  minorUnits: number;
  currency: string;
  scale?: number;
}

/** Format a wire-shaped money value for display. */
export function formatMoney(
  value: MoneyLike,
  options: { locale?: string; display?: 'symbol' | 'code' | 'none'; signed?: boolean } = {},
): string {
  return format(fromMinorUnits(value.minorUnits, value.currency as CurrencyCode), {
    locale: options.locale ?? 'en-US',
    display: options.display ?? 'symbol',
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  });
}

export function splitMoney(value: MoneyLike, locale = 'en-US') {
  return formatParts(fromMinorUnits(value.minorUnits, value.currency as CurrencyCode), { locale });
}

const DATE_STYLES = {
  short: { day: 'numeric', month: 'short' },
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDate(
  value: string | Date,
  style: keyof typeof DATE_STYLES = 'medium',
  locale = 'en-GB',
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, DATE_STYLES[style]).format(date);
}

export function formatTime(value: string | Date, locale = 'en-GB'): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** "Today", "Yesterday", then the date. Statement lists read better grouped this way. */
export function formatRelativeDay(value: string | Date, now = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(date);
  return formatDate(date, 'medium');
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Group an account number or IBAN into readable fours. */
export function groupIdentifier(value: string): string {
  return value.replaceAll(' ', '').replace(/(.{4})/g, '$1 ').trim();
}

export function maskIdentifier(value: string, visible = 4): string {
  const clean = value.replaceAll(' ', '');
  return clean.length <= visible ? clean : `•••• ${clean.slice(-visible)}`;
}

/**
 * Two-letter avatar initials. Falls back to the email local part because staff principals have
 * no customer profile and therefore no first or last name.
 */
export function initialsOf(firstName: string, lastName: string, email?: string): string {
  const fromName = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  if (fromName.length === 2) {
    return fromName.toUpperCase();
  }
  const local = email?.split('@')[0] ?? '';
  return (local.slice(0, 2) || 'IC').toUpperCase();
}
