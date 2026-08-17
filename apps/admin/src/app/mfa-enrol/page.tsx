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
 *
 * There is deliberately no early redirect when the session already shows a second factor: a
 * successful confirm re-renders this page, and bouncing here would unmount the form before the
 * operator has read — and stored — their recovery codes. Instead the enrolment call answers
 * 409 and the form renders an "already on" state, keeping itself (and its state) mounted.
 *
 * The layout mirrors the sign-in split: the task on the left, the brand panel on the right —
 * enrolment is part of the front door, not an errand.
 */
export default async function MfaEnrolPage() {
  const session = await readSession();

  if (!session) {
    redirect('/login');
  }

  let enrolment: TotpEnrolResponse | null = null;
  try {
    enrolment = await api<TotpEnrolResponse>('/auth/totp/enrol', { method: 'POST' });
  } catch (error) {
    // A conflict means the second factor is already enabled — either from another tab, or
    // from the confirm that just succeeded and triggered this re-render.
    if (!(error instanceof ApiError && error.status === 409)) {
      throw error;
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <IcbLogo id="mfa-enrol" />

          <h1 className="mt-12 animate-rise font-display text-3xl font-bold tracking-[-0.02em]">
            Secure your staff account
          </h1>
          <p
            className="mt-2 animate-rise text-sm text-[var(--icb-text-muted)]"
            style={{ animationDelay: '60ms' }}
          >
            Two-factor authentication is required before you can use the operations console.
            This takes about a minute.
          </p>

          <MfaEnrolForm enrolment={enrolment} />
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-brand-tile lg:block">
        <div className="flex h-full flex-col justify-end p-16 text-white">
          <blockquote className="max-w-md">
            <p className="font-display text-3xl leading-tight font-bold tracking-[-0.02em]">
              “One password is a key. A second factor is proof the key is in your hand.”
            </p>
            <footer className="mt-6 text-sm text-[var(--icb-navy-200)]">
              Why every staff account carries two factors
            </footer>
          </blockquote>

          <dl className="mt-14 grid grid-cols-3 gap-8 border-t border-white/10 pt-8">
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Code rotates
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">30s</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Recovery codes
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">10</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.1em] text-[var(--icb-navy-300)] uppercase">
                Sessions audited
              </dt>
              <dd className="tabular mt-1 font-display text-2xl font-bold">All</dd>
            </div>
          </dl>
        </div>
      </aside>
    </div>
  );
}
