import type { AuthenticatedUser } from '@icb/contracts';
import { Card, CardBody, CardHeader } from '@icb/ui';
import type { Metadata } from 'next';

import { TotpDisable } from '@/features/auth/totp-disable';
import { TotpEnrol } from '@/features/auth/totp-enrol';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Two-factor authentication' };

interface TotpEnrolment {
  secret: string;
  otpauthUri: string;
  qrCodeDataUri: string;
}

/**
 * Set up or manage the authenticator.
 *
 * Enrolment is minted fresh on every visit while MFA is off — a half-finished setup never
 * persists, so the QR on screen always matches the secret the API is holding.
 */
export default async function MfaSetupPage() {
  const user = await api<AuthenticatedUser>('/auth/me');

  if (user.mfaEnabled) {
    return (
      <>
        <header>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
            Two-factor authentication
          </h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            Your authenticator is linked. Recovery codes were shown once, at setup.
          </p>
        </header>

        <Card className="mt-8 max-w-2xl">
          <CardHeader
            title="Turn off two-factor authentication"
            description="We strongly recommend keeping this on."
          />
          <CardBody className="pt-0">
            <TotpDisable />
          </CardBody>
        </Card>
      </>
    );
  }

  const enrolment = await api<TotpEnrolment>('/auth/totp/enrol', { method: 'POST', body: {} });

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">
          Set up two-factor authentication
        </h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          A stolen password alone will no longer open your account.
        </p>
      </header>

      <Card className="mt-8 max-w-2xl">
        <CardHeader
          title="Link your authenticator"
          description="Works with any TOTP app — 1Password, Authy, Google Authenticator and the like."
        />
        <CardBody className="pt-0">
          <TotpEnrol secret={enrolment.secret} qrCodeDataUri={enrolment.qrCodeDataUri} />
        </CardBody>
      </Card>
    </>
  );
}
