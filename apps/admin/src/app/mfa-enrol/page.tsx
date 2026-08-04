import type { totpEnrolResponseSchema } from '@icb/contracts';
import { IcbLogo } from '@icb/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { z } from 'zod';

import { MfaEnrolForm } from '@/features/auth/mfa-enrol-form';
import { ApiError, api } from '@/lib/api';
import { readSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Set up two-factor authentication' };

type TotpEnrolResponse = z.infer<typeof totpEnrolResponseSchema>;

/**
 * The mandatory MFA gate.
 *
 * Staff policy requires a second factor before the account goes live, so an operator who signs
 * in without one is routed here and the console layout refuses to render until enrolment is
 * confirmed. The enrolment secret comes from the API on every render — it is never persisted
 * by this app.
 */
export default async function MfaEnrolPage() {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }
  if (session.user.mfaEnabled) {
    redirect('/');
  }

  let enrolment: TotpEnrolResponse;
  try {
    enrolment = await api<TotpEnrolResponse>('/auth/totp/enrol', { method: 'POST' });
  } catch (error) {
    // A conflict means the factor was enabled in another tab between sign-in and now.
    if (error instanceof ApiError && error.status === 409) {
      redirect('/');
    }
    throw error;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <IcbLogo id="mfa-enrol" />

      <h1 className="mt-10 font-display text-3xl font-bold tracking-[-0.02em]">
        Secure your staff account
      </h1>
      <p className="mt-2 text-sm text-[var(--icb-text-muted)]">
        Two-factor authentication is required before you can use the operations console. This
        takes about a minute.
      </p>

      <MfaEnrolForm secret={enrolment.secret} qrCodeDataUri={enrolment.qrCodeDataUri} />
    </div>
  );
}
