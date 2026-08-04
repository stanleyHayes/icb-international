import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/auth-card';
import { VerifyEmailForm } from '@/features/auth/verify-email-form';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string }> }>) {
  const { token } = await searchParams;

  return (
    <AuthCard
      title="Verify your email address"
      subtitle="Enter the code we sent when you opened your account."
    >
      <VerifyEmailForm token={token ?? ''} />
    </AuthCard>
  );
}
