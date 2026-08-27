import { getCurrency, getScale } from './currency.js';
import { toDecimalNumber, type Money } from './money.js';

export interface FormatOptions {
  readonly locale?: string;
  /** `symbol` → "$1,234.56" · `code` → "USD 1,234.56" · `none` → "1,234.56" */
  readonly display?: 'symbol' | 'code' | 'none';
  /** Force a leading `+` on positive amounts. Used for credit rows in a transaction list. */
  readonly signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
  /** Drop the fractional part when it is zero. For headline figures only, never for statements. */
  readonly compactZeroFraction?: boolean;
}

const DEFAULT_LOCALE = 'en-US';

/**
 * Format Money for display.
 *
 * Always goes through `Intl.NumberFormat` so grouping and negative conventions follow the
 * viewer's locale, and always emits the currency's full scale unless explicitly told otherwise —
 * a bank that shows "$1,234.5" has lost the reader's trust.
 */
export function format(money: Money, options: FormatOptions = {}): string {
  const {
    locale = DEFAULT_LOCALE,
    display = 'symbol',
    signDisplay = 'auto',
    compactZeroFraction = false,
  } = options;

  const scale = getScale(money.currency);
  const hasFraction = money.minorUnits % 10 ** scale !== 0;
  const fractionDigits = compactZeroFraction && !hasFraction ? 0 : scale;

  const formatter = new Intl.NumberFormat(locale, {
    style: display === 'symbol' ? 'currency' : 'decimal',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay,
  });

  const formatted = formatter.format(toDecimalNumber(money));
  return display === 'code' ? `${money.currency} ${formatted}` : formatted;
}

/** Split into parts so a UI can style the symbol, integer and fraction independently. */
export interface MoneyParts {
  readonly sign: '' | '-' | '+';
  readonly symbol: string;
  readonly integer: string;
  readonly fraction: string;
  readonly currency: string;
}

function resolveSign(minorUnits: number, signDisplay: NonNullable<FormatOptions['signDisplay']>) {
  if (signDisplay === 'never') {
    return '' as const;
  }
  if (minorUnits < 0) {
    return '-' as const;
  }
  const wantsPlus = signDisplay === 'always' || (signDisplay === 'exceptZero' && minorUnits !== 0);
  return wantsPlus && minorUnits > 0 ? ('+' as const) : ('' as const);
}

export function formatParts(money: Money, options: FormatOptions = {}): MoneyParts {
  const { locale = DEFAULT_LOCALE, signDisplay = 'auto' } = options;
  const scale = getScale(money.currency);

  const formatter = new Intl.NumberFormat(locale, {
    style: 'decimal',
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
    signDisplay: 'never',
  });

  const magnitude = formatter.format(Math.abs(toDecimalNumber(money)));
  const [integer = '0', fraction = ''] = magnitude.split('.');

  return {
    sign: resolveSign(money.minorUnits, signDisplay),
    symbol: getCurrency(money.currency).symbol,
    integer,
    fraction,
    currency: money.currency,
  };
}

/**
 * Compact form for dense dashboards: 1.2K, 3.4M. Never used where an exact figure is required.
 *
 * `trailingZeroDisplay` is not decoration. Without it the trailing zero is left to whichever ICU
 * the runtime happens to carry, and the same figure renders `$5M` on one machine and `$5.0M` on
 * another — which is how this surfaced: green locally, red on CI. A bank cannot have a number that
 * depends on the host it was formatted on, so the strip is stated rather than inherited.
 */
export function formatCompact(money: Money, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'narrowSymbol',
    notation: 'compact',
    maximumFractionDigits: 1,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(toDecimalNumber(money));
}
