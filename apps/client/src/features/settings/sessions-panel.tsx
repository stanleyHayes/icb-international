'use client';

import type { Session } from '@icb/contracts';
import { Button, StatusBadge, formatRelativeDay } from '@icb/ui';
import { AlertCircle, Monitor, Smartphone } from 'lucide-react';
import { useState, useTransition } from 'react';

import { revokeSessionAction } from './security-actions';

/**
 * Active sessions. The current session cannot be revoked from here —
 * signing out everywhere covers that case — because a control that kills the page you are
 * looking at invites the question of whether it worked.
 */
export function SessionsPanel({ sessions }: Readonly<{ sessions: readonly Session[] }>) {
  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {sessions.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </ul>
  );
}

function SessionRow({ session }: Readonly<{ session: Session }>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const Icon = /mobile|iphone|android/i.test(session.device.label) ? Smartphone : Monitor;

  const revoke = () => {
    setError(null);
    startTransition(async () => {
      const result = await revokeSessionAction(session.id);
      if (!result.done) setError(result.error);
    });
  };

  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {session.device.label}
          {session.current ? <StatusBadge status="this device" /> : null}
        </p>
        <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
          {[session.device.browser, session.device.os].filter(Boolean).join(' · ') || 'Unknown client'}
          {' · '}
          {session.location ?? session.ipAddress} · active {formatRelativeDay(session.lastSeenAt)}
        </p>
        {error ? (
          <p role="alert" className="mt-1 flex items-start gap-1 text-xs text-[var(--icb-danger-fg)]">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>
      {!session.current ? (
        <Button variant="secondary" size="sm" onClick={revoke} loading={pending}>
          End session
        </Button>
      ) : null}
    </li>
  );
}
