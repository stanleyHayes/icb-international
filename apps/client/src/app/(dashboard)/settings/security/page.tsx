import type { Session } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ExportDataButton } from '@/features/settings/export-data-button';
import { PasswordForm } from '@/features/settings/password-form';
import { SessionsPanel } from '@/features/settings/sessions-panel';
import { SignOutEverywhere } from '@/features/settings/sign-out-everywhere';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Security' };

/**
 * Security. Every control sits beside the facts it acts on: sessions under the session list,
 * sign-out-everywhere under the lot of them.
 */
export default async function SecurityPage() {
  const sessions = await api<Session[]>('/auth/sessions', { tags: ['sessions'] });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Security</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Changes here take effect immediately, on every device.
        </p>
      </header>

      <Card className="mt-8">
        <CardHeader title="Password" />
        <CardBody className="pt-0">
          <PasswordForm />
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Sessions"
          description="Everywhere you are signed in. End anything you do not recognise."
        />
        <SessionsPanel sessions={sessions} />
        <div className="border-t border-[var(--icb-border)] px-5 py-5">
          <p className="text-sm font-medium">Sign out everywhere</p>
          <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
            Ends every session on every device, including this one. Use this if you think someone
            else has access.
          </p>
          <SignOutEverywhere />
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Your data"
            description="Everything we hold about you, as one file. The link is signed and expires shortly after issue."
          />
          <CardBody className="pt-0">
            <ExportDataButton />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Close your account"
            description="Closure is confirmed by a person, never by a button alone — pending payments and balances need handling first."
          />
          <CardBody className="pt-0">
            <p className="text-sm text-[var(--icb-text-muted)]">
              Send us a secure message and we will start the closure, confirm any remaining
              balance, and tell you exactly when it completes.
            </p>
            <Link
              href={'/support/tickets/new?topic=account'}
              className="mt-3 inline-block text-sm font-medium text-[var(--icb-primary)] hover:underline"
            >
              Request account closure
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
