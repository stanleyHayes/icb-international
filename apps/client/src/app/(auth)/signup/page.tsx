import type { Metadata } from 'next';

import { AuthCard } from '@/features/auth/auth-card';
import { SignupForm } from '@/features/auth/signup-form';

export const metadata: Metadata = { title: 'Open an account' };

export default function SignupPage() {
  return (
    <AuthCard
      title="Open your ICB account"
      subtitle="A few details to start. Identity verification happens after you sign in."
      footer={
        <>
          Already have an account?{' '}
          <a href="/login" className="font-medium text-[var(--icb-primary)] hover:underline">
            Sign in
          </a>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
