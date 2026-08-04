'use client';

import type { Session } from '@icb/contracts';
import { Button, formatDate, formatTime } from '@icb/ui';
import { AlertCircle, Monitor } from 'lucide-react';
import { useActionState } from 'react';

import { revokeSessionAction } from './actions';

/**
 * The signed-in operator's own sessions, each with a kill switch.
 *
 * Shown only on your own staff profile — revoking *another* operator's sessions is an admin
 * action the API does not expose per-user, and pretending otherwise would be theatre.
 */
export function SessionList({ sessions }: Readonly<{ sessions: Session[] }>) {
  const [state, action, pending] = useActionState(revokeSessionAction, {
    status: 'idle',
    message: null,
  });

  return (
    <div className="space-y-3">
      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <ul className="divide-y divide-[var(--icb-border)]">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center gap-4 py-3">
            <Monitor size={16} className="shrink-0 text-[var(--icb-text-subtle)]" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {session.device.label}
                {session.current ? (
                  <span className="ml-2 rounded-full bg-[var(--icb-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--icb-success-fg)]">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
                {[session.device.browser, session.device.os].filter(Boolean).join(' · ') || 'Unknown client'}
                {' · '}
                {session.ipAddress}
                {' · last seen '}
                {formatDate(session.lastSeenAt, 'short')} {formatTime(session.lastSeenAt)}
              </p>
            </div>
            {session.current ? null : (
              <form action={action}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button type="submit" variant="secondary" size="sm" loading={pending}>
                  Revoke
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
