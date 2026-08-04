'use client';

import type { Session } from '@icb/contracts';
import { Button, formatDate } from '@icb/ui';
import { Laptop, Smartphone } from 'lucide-react';
import { useTransition } from 'react';

import { revokeSessionAction } from './security-actions';

/**
 * Every place this account is signed in, newest activity first.
 *
 * The current session is labelled, not listed as a target — you revoke *other* devices from the
 * one you trust, never the ground you are standing on.
 */
export function SessionList({ sessions }: Readonly<{ sessions: Session[] }>) {
  const [pending, startTransition] = useTransition();

  return (
    <ul className="divide-y divide-[var(--icb-border)]">
      {sessions.map((session) => (
        <li key={session.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
          >
            {isMobile(session.device.label, session.device.os) ? (
              <Smartphone size={16} />
            ) : (
              <Laptop size={16} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {session.device.label}
              {session.current ? (
                <span className="ml-2 rounded-full bg-[var(--icb-success-bg)] px-2 py-0.5 text-xs font-medium text-[var(--icb-success-fg)]">
                  This device
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
              {[session.device.browser, session.device.os, session.location ?? session.ipAddress]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
              Last active {formatDate(session.lastSeenAt, 'long')}
            </p>
          </div>

          {session.current ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  await revokeSessionAction(session.id, session.current);
                });
              }}
            >
              Sign out
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function isMobile(label: string, os: string | null): boolean {
  const haystack = `${label} ${os ?? ''}`.toLowerCase();
  return haystack.includes('iphone') || haystack.includes('android') || haystack.includes('mobile');
}
