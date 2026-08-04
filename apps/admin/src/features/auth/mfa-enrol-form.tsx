'use client';

import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useId, useState } from 'react';

import { confirmTotpAction, INITIAL_MFA_ENROL_STATE } from './mfa-actions';

interface MfaEnrolFormProps {
  /** Base32 secret for manual entry, when scanning is not possible. */
  secret: string;
  /** PNG data URI rendered as the scannable code. */
  qrCodeDataUri: string;
}

/**
 * The two-step enrolment: scan (or type) the secret, then prove possession with the first code.
 * On success the recovery codes replace the form — they are the only copy the operator ever sees.
 */
export function MfaEnrolForm({ secret, qrCodeDataUri }: Readonly<MfaEnrolFormProps>) {
  const [state, action, pending] = useActionState(confirmTotpAction, INITIAL_MFA_ENROL_STATE);
  const codeId = useId();

  if (state.status === 'enrolled' && state.recoveryCodes) {
    return <RecoveryCodes codes={state.recoveryCodes} />;
  }

  return (
    <div className="mt-8 space-y-8">
      <ol className="space-y-6">
        <li className="flex gap-4">
          <StepNumber value={1} />
          <div className="min-w-0">
            <p className="text-sm font-medium">Add ICB to your authenticator</p>
            <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
              Scan this code with your authenticator app, or enter the key manually.
            </p>
            {/* A data URI from the API, so next/image's static loader does not apply. */}
            <img
              src={qrCodeDataUri}
              alt="Authenticator setup QR code for ICB Operations"
              className="mt-4 h-44 w-44 rounded-[var(--radius-md)] border border-[var(--icb-border)]"
            />
            <SecretValue secret={secret} />
          </div>
        </li>

        <li className="flex gap-4">
          <StepNumber value={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Enter the first code</p>
            <form action={action} className="mt-3 space-y-4">
              {state.message ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
                >
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {state.message}
                </p>
              ) : null}
              <div>
                <label htmlFor={codeId} className="block text-sm font-medium">
                  6-digit code
                </label>
                <input
                  id={codeId}
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  minLength={6}
                  maxLength={6}
                  className="tabular mt-1.5 h-11 w-40 rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-center text-sm tracking-[0.3em] outline-none focus:border-[var(--icb-primary)]"
                />
              </div>
              <Button type="submit" loading={pending}>
                {pending ? 'Confirming…' : 'Enable two-factor authentication'}
              </Button>
            </form>
          </div>
        </li>
      </ol>
    </div>
  );
}

function RecoveryCodes({ codes }: Readonly<{ codes: string[] }>) {
  const [copied, setCopied] = useState(false);

  const copyAll = () => {
    void navigator.clipboard.writeText(codes.join('\n')).then(() => setCopied(true));
  };

  return (
    <div className="mt-8 space-y-6">
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Two-factor authentication is on. Store these recovery codes somewhere safe — they are shown
        once and each works a single time if you lose your device.
      </p>

      <ul className="tabular grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={copyAll} leadingIcon={<Copy size={15} />}>
          {copied ? 'Copied' : 'Copy codes'}
        </Button>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
        >
          Continue to the console
        </Link>
      </div>
    </div>
  );
}

function StepNumber({ value }: Readonly<{ value: number }>) {
  return (
    <span
      aria-hidden="true"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--icb-primary)] text-xs font-semibold text-white"
    >
      {value}
    </span>
  );
}

function SecretValue({ secret }: Readonly<{ secret: string }>) {
  return (
    <p className="mt-3 text-xs text-[var(--icb-text-subtle)]">
      Manual entry key:{' '}
      <code className="rounded bg-[var(--icb-bg-subtle)] px-1.5 py-0.5 font-mono text-[var(--icb-text)]">
        {secret}
      </code>
    </p>
  );
}
