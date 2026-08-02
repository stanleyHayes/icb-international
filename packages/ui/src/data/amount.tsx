import { cn } from '../lib/cn';
import { formatMoney, type MoneyLike } from '../lib/format';

export type AmountProps = Readonly<{
  value: MoneyLike;
  /** Colour and sign by direction. Omit for a neutral figure such as a balance. */
  direction?: 'debit' | 'credit';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'display';
  showCurrency?: boolean;
  className?: string;
}>;

/** A debit renders negative, a credit positive; a directionless figure keeps its own sign. */
function signFor(direction: AmountProps['direction']): 1 | -1 {
  return direction === 'debit' ? -1 : 1;
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
  display: 'text-4xl sm:text-5xl',
} as const;

/**
 * A monetary figure.
 *
 * Always tabular, so columns of numbers line up and a changing balance does not make the layout
 * jitter. Direction drives both the sign and the colour, and the sign is present in the text
 * itself — colour alone would fail for a colour-blind reader.
 */
export function Amount({
  value,
  direction,
  size = 'md',
  showCurrency = false,
  className,
}: AmountProps) {
  const signed = signFor(direction);
  const display = { ...value, minorUnits: Math.abs(value.minorUnits) * signed };
  const formatted = formatMoney(display, { signed: direction !== undefined });

  return (
    <span
      className={cn(
        'tabular font-semibold whitespace-nowrap',
        SIZES[size],
        direction === 'credit' && 'text-[var(--icb-credit)]',
        direction === 'debit' && 'text-[var(--icb-debit)]',
        size === 'display' && 'font-display tracking-[-0.02em]',
        className,
      )}
    >
      {formatted}
      {showCurrency ? (
        <span className="ml-1.5 text-[0.6em] font-semibold tracking-[0.08em] text-[var(--icb-text-subtle)]">
          {value.currency}
        </span>
      ) : null}
    </span>
  );
}
