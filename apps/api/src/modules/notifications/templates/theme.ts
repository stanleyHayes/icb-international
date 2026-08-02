import type { MoneyDto } from '@icb/contracts';
import { format, fromMinorUnits } from '@icb/money';

/**
 * The ICB brand, expressed as inline-safe values.
 *
 * Email clients strip `<style>` blocks, ignore custom properties, and load no web fonts, so the
 * brand has to survive as literal hex and a font *stack* whose first entry (Outfit) is used when
 * the reader happens to have it and whose fallbacks are metrically close when they do not.
 */
export const BRAND = {
  navy: '#0B2C4D',
  primary: '#0F4C81',
  gold: '#C9A227',
  ink: '#12212F',
  muted: '#5B6B7B',
  line: '#E3E9EF',
  surface: '#FFFFFF',
  canvas: '#F4F7FA',
  danger: '#B3261E',
  success: '#1B7F4B',
  onDark: '#F7FAFC',
} as const;

export const FONT_STACK = "Outfit, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape before interpolation, without exception.
 *
 * Payload values reach these templates from transfer references, merchant names and dispute
 * notes — all attacker-influencable. An unescaped `<` in a merchant name is an HTML injection
 * into a message the customer has every reason to trust.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

/** Money for humans. Never a float, never a raw minor-unit integer in prose. */
export function formatMoney(amount: MoneyDto): string {
  return format(fromMinorUnits(amount.minorUnits, amount.currency));
}

/** A stable, unambiguous instant: `2 August 2026 at 14:05 UTC`. */
export function formatInstant(at: Date): string {
  const date = at.toISOString().slice(0, 10);
  const time = at.toISOString().slice(11, 16);
  const [year = '', month = '', day = ''] = date.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''} ${year} at ${time} UTC`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Only absolute http(s) links and app-relative paths become anchors.
 *
 * A deep link arrives as data on the payload, and `javascript:` in an href inside a message the
 * customer trusts is exactly the primitive a phishing chain wants. Anything else is dropped.
 */
export function safeUrl(value: string): string | null {
  if (value.startsWith('/')) {
    return value;
  }
  const lowered = value.toLowerCase();
  return lowered.startsWith('https://') || lowered.startsWith('http://') ? value : null;
}

/** A calendar date on its own, for due dates and statement periods. */
export function formatDate(isoDate: string): string {
  const [year = '', month = '', day = ''] = isoDate.slice(0, 10).split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? ''} ${year}`;
}
