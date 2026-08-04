'use client';

import { useState } from 'react';

import { cn } from '../lib/cn';
import { groupIdentifier, maskIdentifier } from '../lib/format';
import { IconEye, IconEyeOff } from '../primitives/icons';

export type AccountNumberProps = Readonly<{
  /** The full account number or IBAN. Never rendered until the holder asks for it. */
  value: string;
  /** Show the eye toggle. When false the number stays masked — the default for lists. */
  revealable?: boolean;
  /** Called the first time the number is revealed, so the app can audit or step-up the reveal. */
  onReveal?: () => void;
  className?: string;
}>;

/**
 * An account number, masked by default with reveal on demand.
 *
 * Masking is the default everywhere: a full account number on screen is a shoulder-surfing leak
 * and almost never what the reader needs — the last four identify the account. The toggle is a
 * button with `aria-pressed` so the state is announced, not just drawn.
 */
export function AccountNumber({ value, revealable = true, onReveal, className }: AccountNumberProps) {
  const [revealed, setRevealed] = useState(false);

  const display = revealed ? groupIdentifier(value) : maskIdentifier(value);

  function toggle() {
    if (!revealed) {
      onReveal?.();
    }
    setRevealed((current) => !current);
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="tabular font-medium tracking-[0.04em] whitespace-nowrap">{display}</span>
      {revealable ? (
        <button
          type="button"
          onClick={toggle}
          aria-pressed={revealed}
          aria-label={revealed ? 'Hide account number' : 'Reveal account number'}
          className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--icb-text-subtle)] hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
        >
          {revealed ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      ) : null}
    </span>
  );
}
