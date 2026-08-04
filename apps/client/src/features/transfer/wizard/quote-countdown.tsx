'use client';

import { useEffect, useState } from 'react';

function secondsUntil(iso: string, now: number): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000));
}

function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Live countdown to a quote's expiry.
 *
 * Quotes are single-use and rate-locked; when the TTL lapses the parent disables confirmation
 * and offers a re-quote, so a stale rate can never be executed.
 */
export function QuoteCountdown({
  expiresAt,
  onExpired,
}: Readonly<{ expiresAt: string; onExpired: () => void }>) {
  const [remaining, setRemaining] = useState(() => secondsUntil(expiresAt, Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      const left = secondsUntil(expiresAt, Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        onExpired();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpired]);

  const toneClass = countdownTone(remaining);

  return (
    <p role="timer" aria-live="off" className={toneClass}>
      {remaining === 0 ? (
        'This quote has expired.'
      ) : (
        <>
          Rate held for{' '}
          <span className="tabular font-semibold">{formatRemaining(remaining)}</span>
        </>
      )}
    </p>
  );
}

function countdownTone(remaining: number): string {
  if (remaining === 0) {
    return 'text-sm font-medium text-[var(--icb-danger-fg)]';
  }
  if (remaining <= 30) {
    return 'text-sm font-medium text-[var(--icb-warning-fg)]';
  }
  return 'text-sm text-[var(--icb-text-muted)]';
}
