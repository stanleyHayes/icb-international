import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/auth-card';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email address and we will send you a reset code."
      footer={
        <>
          Remembered it?{' '}
          <a href="/login" className="font-medium text-[var(--icb-primary)] hover:underline">
            Back to sign in
          </a>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
