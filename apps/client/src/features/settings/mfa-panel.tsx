'use client';

import type { RecoveryCodes } from '@icb/contracts';
import { Button, Field, OTPInput } from '@icb/ui';
import { AlertCircle } from 'lucide-react';
import { useState, useTransition } from 'react';

import {
  totpConfirmAction,
  totpDisableAction,
  totpEnrolAction,
  type TotpEnrolment,
} from './security-actions';

type Step =
  | { name: 'idle' }
  | { name: 'enrolling'; enrolment: TotpEnrolment }
  | { name: 'confirmed'; codes: RecoveryCodes };

/** A FormData value is string | File | null; the OTP field is always a string when present. */
function codeOf(formData: FormData): string {
  const value = formData.get('code');
  return typeof value === 'string' ? value : '';
}

/**
 * Two-factor enrolment and removal.
 *
 * Enrolment is a three-step exchange — scan, prove the authenticator works with its first code,
 * then save the recovery codes — and the recovery codes are the point of no return: they are
 * shown once and never retrievable again, which the copy says before the customer can leave.
 */
export function MfaPanel({ enabled }: Readonly<{ enabled: boolean }>) {
  const [step, setStep] = useState<Step>({ name: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const begin = () => {
    setError(null);
    startTransition(async () => {
      const result = await totpEnrolAction();
      if (result.enrolment) setStep({ name: 'enrolling', enrolment: result.enrolment });
      else setError(result.error);
    });
  };

  const disable = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await totpDisableAction(codeOf(formData));
      if (!result.done) setError(result.error);
    });
  };

  if (step.name === 'enrolling') {
    return <EnrolStep enrolment={step.enrolment} onConfirmed={(codes) => setStep({ name: 'confirmed', codes })} />;
  }
  if (step.name === 'confirmed') {
    return <RecoveryCodesStep codes={step.codes} />;
  }

  return (
    <div>
      {enabled ? (
        <form action={disable} className="space-y-4">
          <p className="text-sm text-[var(--icb-text-muted)]">
            Enabled. Required at sign-in and for sensitive actions. To turn it off, enter a
            current code from your authenticator.
          </p>
          <Field label="Authenticator code" required>
            <OTPInput name="code" />
          </Field>
          <Button type="submit" variant="secondary" loading={pending}>
            Turn off two-factor authentication
          </Button>
        </form>
      ) : (
        <div>
          <p className="text-sm text-[var(--icb-text-muted)]">
            Not enabled. Add an authenticator app and sign-ins and sensitive actions will need a
            six-digit code as well as your password.
          </p>
          <Button onClick={begin} loading={pending} className="mt-4">
            Set up two-factor authentication
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EnrolStep({
  enrolment,
  onConfirmed,
}: Readonly<{ enrolment: TotpEnrolment; onConfirmed: (codes: RecoveryCodes) => void }>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await totpConfirmAction(codeOf(formData));
      if (result.codes) onConfirmed(result.codes);
      else setError(result.error);
    });
  };

  return (
    <form action={confirm} className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--icb-text-muted)]">
        <li>Scan this code with your authenticator app.</li>
        <li>Enter the six-digit code it shows.</li>
      </ol>
      {/* The QR is a data URI minted by the API for this enrolment only; next/image cannot optimise a data URI. */}
      <img src={enrolment.qrCodeDataUri} alt="QR code for your authenticator app" className="h-40 w-40 rounded-[var(--radius-md)] border border-[var(--icb-border)]" />
      <p className="text-xs text-[var(--icb-text-subtle)]">
        Cannot scan? Enter this key manually:{' '}
        <code className="font-mono text-[var(--icb-text)]">{enrolment.secret}</code>
      </p>
      <Field label="Six-digit code" required>
        <OTPInput name="code" />
      </Field>
      <Button type="submit" loading={pending}>
        Confirm and enable
      </Button>
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-[var(--icb-danger-fg)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </form>
  );
}

function RecoveryCodesStep({ codes }: Readonly<{ codes: RecoveryCodes }>) {
  return (
    <div>
      <p className="text-sm font-medium">Two-factor authentication is on.</p>
      <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
        These recovery codes get you back in if you lose your device. Each works once. They are
        shown <strong className="text-[var(--icb-text)]">only now</strong> — store them somewhere
        safe before you leave this page.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {codes.codes.map((code) => (
          <li
            key={code}
            className="rounded-[var(--radius-md)] bg-[var(--icb-bg-muted)] px-2 py-1.5 text-center font-mono text-xs"
          >
            {code}
          </li>
        ))}
      </ul>
    </div>
  );
}
