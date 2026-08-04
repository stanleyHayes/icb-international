import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AuthCard } from '@/features/auth/auth-card';
import { MfaChallengeForm } from '@/features/auth/mfa-challenge-form';

export const metadata: Metadata = { title: 'Two-factor authentication' };

const METHODS = new Set(['totp', 'sms', 'recovery_code']);

/**
 * The second half of sign-in, reached only when the API answered a password with a challenge.
 *
 * Without a challenge id in the URL there is nothing to verify, so the route bounces back to
 * sign-in rather than rendering a dead form.
 */
export default async function MfaPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ challengeId?: string; method?: string; hint?: string }>;
}>) {
  const { challengeId, method, hint } = await searchParams;

  if (!challengeId || !method || !METHODS.has(method)) {
    redirect('/login');
  }

  return (
    <AuthCard
      title="Check it's you"
      subtitle="Your password was right. One more proof before we open your session."
    >
      <MfaChallengeForm
        challengeId={challengeId}
        method={method as 'totp' | 'sms' | 'recovery_code'}
        {...(hint ? { hint } : {})}
      />
    </AuthCard>
  );
}
