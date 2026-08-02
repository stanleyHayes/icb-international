import type { AuthenticatedUser } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { KeyRound, Mail, Smartphone } from 'lucide-react';
import type { Metadata } from 'next';

import { SignOutEverywhere } from '@/features/settings/sign-out-everywhere';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Settings' };

/**
 * Profile and security.
 *
 * Security actions live beside the facts they act on: the sign-out control sits under the
 * session summary, not on a separate screen a worried customer has to go looking for.
 */
export default async function SettingsPage() {
  const user = await api<AuthenticatedUser>('/auth/me');

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Your details and how your account is protected.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your details" />
          <CardBody className="pt-0">
            <dl className="space-y-3 text-sm">
              <Row label="Name" value={`${user.firstName} ${user.lastName}`.trim() || '—'} />
              <Row label="Email" value={user.email} />
              <Row
                label="Email verified"
                value={<StatusBadge status={user.emailVerified ? 'verified' : 'pending'} />}
              />
              <Row
                label="Last signed in"
                value={user.lastLoginAt ? formatDate(user.lastLoginAt, 'long') : 'This session'}
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Security"
            description="Changes here take effect immediately across every device."
          />
          <CardBody className="pt-0">
            <ul className="space-y-4">
              <SecurityRow
                icon={<KeyRound size={17} />}
                title="Password"
                detail="Argon2id hashed. We cannot read it, and neither can anyone who reaches our database."
              />
              <SecurityRow
                icon={<Smartphone size={17} />}
                title="Two-factor authentication"
                detail={
                  user.mfaEnabled
                    ? 'Enabled. Required at sign-in and for sensitive actions.'
                    : 'Not enabled. Sensitive actions still require re-authentication.'
                }
              />
              <SecurityRow
                icon={<Mail size={17} />}
                title="Security alerts"
                detail="We email you on a new-device sign-in, a password change, and any large or unusual transaction."
              />
            </ul>

            <div className="mt-6 border-t border-[var(--icb-border)] pt-5">
              <p className="text-sm font-medium">Sign out everywhere</p>
              <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
                Ends every session on every device, including this one. Use this if you think
                someone else has access.
              </p>
              <SignOutEverywhere />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="How your session is protected"
          description="Not a promise — the specific mechanism."
        />
        <CardBody className="pt-0">
          <ul className="grid gap-4 text-sm text-[var(--icb-text-muted)] sm:grid-cols-2">
            <li>
              <strong className="text-[var(--icb-text)]">Tokens never reach your browser.</strong>{' '}
              This dashboard renders on our server and holds your credentials in an encrypted
              cookie only the server can open, so a script injected into the page has nothing to
              steal.
            </li>
            <li>
              <strong className="text-[var(--icb-text)]">Sessions rotate.</strong> Your session
              token is replaced every time it is renewed. If an old one is ever presented, every
              session in that family is revoked at once — because the only way that happens is
              theft.
            </li>
          </ul>
        </CardBody>
      </Card>
    </>
  );
}

function Row({ label, value }: Readonly<{ label: string; value: React.ReactNode }>) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--icb-border)] pb-3 last:border-0 last:pb-0">
      <dt className="shrink-0 text-[var(--icb-text-subtle)]">{label}</dt>
      <dd className="text-right break-all">{value}</dd>
    </div>
  );
}

function SecurityRow({
  icon,
  title,
  detail,
}: Readonly<{ icon: React.ReactNode; title: string; detail: string }>) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">{detail}</p>
      </div>
    </li>
  );
}
