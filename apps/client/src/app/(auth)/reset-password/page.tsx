import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/auth-card';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password' };

export default async function ResetPasswordPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const { token } = await searchParams;

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="Changing your password signs out every other session on your account."
      footer={
        <>
          No code?{' '}
          <a
            href="/forgot-password"
            className="font-medium text-[var(--icb-primary)] hover:underline"
          >
            Request a new one
          </a>
        </>
      }
    >
      <ResetPasswordForm token={token ?? ''} />
    </AuthCard>
  );
}
