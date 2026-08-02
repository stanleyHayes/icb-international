import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The button.
 *
 * `primary` is reserved for the single most important action on a view — a screen with three
 * primary buttons has no primary action. `danger` is for irreversible operations only, so its
 * colour keeps its meaning.
 */
const button = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[var(--ease-out)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:translate-y-px',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--icb-primary)] text-white shadow-[var(--shadow-xs)] hover:bg-[var(--icb-primary-hover)]',
        secondary:
          'bg-[var(--icb-surface)] text-[var(--icb-text)] border border-[var(--icb-border-strong)] hover:bg-[var(--icb-bg-muted)]',
        ghost: 'bg-transparent text-[var(--icb-text)] hover:bg-[var(--icb-bg-muted)]',
        accent:
          'bg-[var(--icb-accent)] text-[var(--icb-navy-900)] shadow-[var(--shadow-xs)] hover:bg-[var(--icb-accent-hover)]',
        danger: 'bg-[var(--icb-danger)] text-white hover:brightness-110',
        link: 'bg-transparent text-[var(--icb-primary)] underline underline-offset-4 hover:opacity-80 px-0',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem] rounded-[var(--radius-sm)]',
        md: 'h-10 px-4 text-sm rounded-[var(--radius-md)]',
        lg: 'h-12 px-6 text-base rounded-[var(--radius-md)]',
        icon: 'h-10 w-10 rounded-[var(--radius-md)]',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

interface ButtonOwnProps {
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & ButtonOwnProps
>;

export function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(button({ variant, size, block }), className)}
      disabled={disabled === true || loading}
      // Announce the pending state rather than only showing a spinner.
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
