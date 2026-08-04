import type { AuthenticatedUser } from '@icb/contracts';
import { Card, CardBody, CardHeader, StatusBadge, formatDate } from '@icb/ui';
import { Bell, ChevronRight, KeyRound, Palette, Smartphone, User } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Settings' };

const SECTIONS = [
  {
    href: '/settings/profile',
    icon: User,
    title: 'Profile',
    detail: 'Your name, addresses, contact details and employment.',
  },
  {
    href: '/settings/security',
    icon: KeyRound,
    title: 'Security',
    detail: 'Password, two-factor authentication, sessions and your data.',
  },
  {
    href: '/settings/notifications',
    icon: Bell,
    title: 'Notifications',
    detail: 'Which events reach you, on which channel, and when to stay quiet.',
  },
  {
    href: '/settings/preferences',
    icon: Palette,
    title: 'Preferences',
    detail: 'Language, timezone, statement delivery and appearance.',
  },
] as const;

/**
 * Settings overview: the state of the account at a glance, with each section one tap away.
 * Editing happens in the sections, not here — an overview that also edits is neither.
 */
export default async function SettingsPage() {
  const user = await api<AuthenticatedUser>('/auth/me', { tags: ['profile'] });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Your details and how your account is protected.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
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
          <CardHeader title="Security at a glance" />
          <CardBody className="pt-0">
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <KeyRound size={17} className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)]" />
                <p>
                  <span className="font-medium">Password.</span>{' '}
                  <span className="text-[var(--icb-text-muted)]">
                    Argon2id hashed — we cannot read it, and neither can anyone who reaches our
                    database.
                  </span>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <Smartphone size={17} className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)]" />
                <p>
                  <span className="font-medium">Two-factor authentication.</span>{' '}
                  <span className="text-[var(--icb-text-muted)]">
                    {user.mfaEnabled
                      ? 'Enabled. Required at sign-in and for sensitive actions.'
                      : 'Not enabled — turn it on under Security.'}
                  </span>
                </p>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>

      <nav aria-label="Settings sections" className="mt-6">
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--icb-border)]">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href as Route}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--icb-bg-subtle)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]"
                  >
                    <section.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{section.title}</span>
                    <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">
                      {section.detail}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[var(--icb-text-subtle)]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </nav>
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
