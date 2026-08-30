import { KeyRound, LifeBuoy } from 'lucide-react';
import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/auth-card';
import type { Route } from 'next';

export const metadata: Metadata = { title: 'Account recovery' };

// Typed at the constant, not the call site: this is an absolute URL to a different origin, so
// `typedRoutes` can never know it, and an inline `as Route` on the <Link> is exactly what
// `eslint --fix` strips when the dev route table makes it look redundant.
const MARKETING_URL = (process.env.NEXT_PUBLIC_MARKETING_URL ??
  'http://localhost:3100') as Route;

const OPTIONS = [
  {
    href: '/forgot-password',
    icon: KeyRound,
    title: 'Forgotten password',
    detail: 'We email you a one-time code, you choose a new password, and every other session is signed out.',
  },
  {
    href: `${MARKETING_URL}/help`,
    icon: LifeBuoy,
    title: 'No password, or no access to your email',
    detail: 'Contact support. Regaining access takes identity checks — that delay is your money staying safe.',
  },
] as const;

/**
 * The front door for a locked-out customer.
 *
 * Recovery is routing, not a form: each path has different proof requirements, so the page's job
 * is to get the customer onto the right one with honest expectations set up front.
 */
export default function RecoverPage() {
  return (
    <AuthCard
      title="Recover your account"
      subtitle="Choose the situation that matches yours."
      footer={
        <>
          Remembered everything?{' '}
          <a href="/login" className="font-medium text-[var(--icb-primary)] hover:underline">
            Back to sign in
          </a>
        </>
      }
    >
      <ul className="space-y-3">
        {OPTIONS.map((option) => (
          <li key={option.href + option.title}>
            <a
              href={option.href}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--icb-border)] px-4 py-3.5 transition-colors hover:border-[var(--icb-primary)] hover:bg-[var(--icb-bg-muted)]"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
              >
                <option.icon size={16} />
              </span>
              <span>
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="mt-0.5 block text-sm text-[var(--icb-text-muted)]">
                  {option.detail}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </AuthCard>
  );
}
