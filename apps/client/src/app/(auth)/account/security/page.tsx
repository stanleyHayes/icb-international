import type { AuthenticatedUser, Session } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge } from '@icb/ui';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SessionList } from '@/features/auth/session-list';
import { SignOutEverywhere } from '@/features/settings/sign-out-everywhere';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Security' };

/**
 * Sign-in security: the second factor, and every live session.
 *
 * This is the screen a worried customer needs at 2am — "is anyone else in my account, and can I
 * throw them out?" — so sessions lead and the controls sit beside the facts they act on.
 */
export default async function SecurityPage() {
  const [user, sessions] = await Promise.all([
    api<AuthenticatedUser>('/auth/me'),
    api<Session[]>('/auth/sessions'),
  ]);

  const otherSessions = sessions.filter((session) => !session.current).length;
  let sessionSummary = 'Only this device is signed in.';
  if (otherSessions === 1) {
    sessionSummary = '1 other device is signed in.';
  } else if (otherSessions > 1) {
    sessionSummary = `${String(otherSessions)} other devices are signed in.`;
  }

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Security</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          How you prove it&apos;s you, and everywhere your account is signed in.
        </p>
      </header>

      <Card className="mt-8">
        <CardHeader
          title="Two-factor authentication"
          description="Required at sign-in on new devices and before sensitive actions."
        />
        <CardBody className="pt-0">
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
            >
              {user.mfaEnabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
            </span>
            <div className="min-w-0 flex-1">
              <StatusBadge status={user.mfaEnabled ? 'active' : 'not_started'} />
              <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
                {user.mfaEnabled
                  ? 'Your authenticator app is linked. Keep your recovery codes somewhere safe.'
                  : 'Link an authenticator app so a stolen password alone cannot open your account.'}
              </p>
            </div>
            <Link
              href="/account/security/mfa"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
            >
              {user.mfaEnabled ? 'Manage' : 'Set up two-factor authentication'}
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Active sessions" description={sessionSummary} />
        <CardBody className="pt-0">
          <SessionList sessions={sessions} />

          <div className="mt-6 border-t border-[var(--icb-border)] pt-5">
            <p className="text-sm font-medium">Sign out everywhere</p>
            <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
              Ends every session on every device, including this one. Use this if you think someone
              else has access.
            </p>
            <SignOutEverywhere />
          </div>
        </CardBody>
      </Card>
    </>
  );
}
