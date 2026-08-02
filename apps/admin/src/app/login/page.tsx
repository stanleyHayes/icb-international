import { IcbLogo } from '@icb/ui';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'Sign in' };

const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ reason?: string }>;
}>) {
  const { reason } = await searchParams;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href={MARKETING_URL as Route} aria-label="ICB home">
            <IcbLogo id="login" />
          </Link>

          <h1 className="mt-12 font-display text-3xl font-bold tracking-[-0.02em]">
            ICB Operations
          </h1>
          <p className="mt-2 text-sm text-[var(--icb-text-muted)]">
            Staff sign-in. All actions are audited.
          </p>

          {reason === 'expired' ? (
            <p
              role="status"
              className="mt-6 rounded-[var(--radius-md)] border border-[var(--icb-warning-border)] bg-[var(--icb-warning-bg)] px-4 py-3 text-sm text-[var(--icb-warning-fg)]"
            >
              Your session ended for security. Please sign in again.
            </p>
          ) : null}

          <LoginForm />

          <p className="mt-10 text-xs text-[var(--icb-text-subtle)]">
            Access is granted by role. Contact the operations lead if you need a permission
            changed.
          </p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand-tile lg:block">
        <div className="flex h-full flex-col justify-end p-16 text-white">
          <blockquote className="max-w-md">
            <p className="font-display text-3xl leading-tight font-bold tracking-[-0.02em]">
              “Four eyes on every manual posting. No exceptions, no overrides.”
            </p>
            <footer className="mt-6 text-sm text-[var(--icb-navy-200)]">
              ICB back-office controls
            </footer>
          </blockquote>

          <dl className="mt-14 grid grid-cols-3 gap-8 border-t border-white/10 pt-8">
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Currencies
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">15</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Drift
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">0.00</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Checks
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">24/7</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
