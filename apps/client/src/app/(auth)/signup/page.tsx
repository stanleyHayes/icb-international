import { IcbLogo } from '@icb/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { SignupForm } from '@/features/auth/signup-form';
import type { Route } from 'next';

export const metadata: Metadata = { title: 'Open an account' };

// Typed at the constant, not the call site: this is an absolute URL to a different origin, so
// `typedRoutes` can never know it, and an inline `as Route` on the <Link> is exactly what
// `eslint --fix` strips when the dev route table makes it look redundant.
const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ??
  'http://localhost:3100') as Route;

export default function SignupPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href={MARKETING_URL} aria-label="ICB home">
            <IcbLogo id="signup" />
          </Link>

          <h1 className="mt-12 font-display text-3xl font-bold tracking-[-0.02em]">
            Open your ICB account
          </h1>
          <p className="mt-2 text-sm text-[var(--icb-text-muted)]">
            A few details to start. Identity verification happens after you sign in.
          </p>

          <SignupForm />

          <p className="mt-10 text-sm text-[var(--icb-text-muted)]">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-[var(--icb-primary)] hover:underline">
              Sign in
            </a>
          </p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand-tile lg:block">
        <div className="flex h-full flex-col justify-end p-16 text-white">
          <blockquote className="max-w-md">
            <p className="font-display text-3xl leading-tight font-bold tracking-[-0.02em]">
              “Open the account in minutes. Keep it for the ledger behind it.”
            </p>
            <footer className="mt-6 text-sm text-[var(--icb-navy-200)]">
              Why banking with ICB is different
            </footer>
          </blockquote>

          <dl className="mt-14 grid grid-cols-3 gap-8 border-t border-white/10 pt-8">
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Protected
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">250,000</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Hidden fees
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">0</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Currencies
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">15</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
