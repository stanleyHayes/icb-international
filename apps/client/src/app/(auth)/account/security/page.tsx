import type { Session } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { SessionList } from '@/features/auth/session-list';
import { SignOutEverywhere } from '@/features/settings/sign-out-everywhere';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Security' };

/**
 * Sign-in security: every live session in one place.
 *
 * This is the screen a worried customer needs at 2am — "is anyone else in my account, and can I
 * throw them out?" — so sessions lead and the controls sit beside the facts they act on.
 */
export default async function SecurityPage() {
  const sessions = await api<Session[]>('/auth/sessions');

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
