'use client';

import { useEffect, useState } from 'react';

const SECOND_MS = 1_000;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / SECOND_MS));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Time left before an undecided request expires. The deadline is enforced by the server; this
 * exists so a checker never loses work to a clock they could not see.
 */
export function ExpiryCountdown({ expiresAt }: Readonly<{ expiresAt: string }>) {
  const deadline = new Date(expiresAt).getTime();
  const [remaining, setRemaining] = useState(() => deadline - Date.now());

  useEffect(() => {
    const timer = setInterval(() => setRemaining(deadline - Date.now()), SECOND_MS);
    return () => clearInterval(timer);
  }, [deadline]);

  if (remaining <= 0) {
    return <span className="text-[var(--icb-danger-fg)]">Expired</span>;
  }

  const urgent = remaining < 3_600_000;
  return (
    <span
      className={`tabular ${urgent ? 'font-medium text-[var(--icb-warning-fg)]' : ''}`}
      title={new Date(expiresAt).toLocaleString()}
    >
      {formatRemaining(remaining)} left
    </span>
  );
}
