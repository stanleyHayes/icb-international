'use client';

import { Button, OTPInput } from '@icb/ui';
import { AlertCircle, Check, CheckCircle2, Copy } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useId, useState, useTransition } from 'react';

import { confirmTotpAction, type MfaEnrolState } from './mfa-actions';

// Kept locally: server-action modules may only export async functions, so this cannot be
// imported from './mfa-actions'.
const INITIAL_MFA_ENROL_STATE: MfaEnrolState = {
  status: 'idle',
  message: null,
  recoveryCodes: null,
};

interface MfaEnrolFormProps {
  /**
   * The enrolment material from the API. Null when the API reports the second factor already
   * enabled (409) — including the re-render right after a successful confirm, where the form
   * must stay mounted so the recovery codes in its state are not lost.
   */
  enrolment: {
    /** Base32 secret for manual entry, when scanning is not possible. */
    secret: string;
    /** PNG data URI rendered as the scannable code. */
    qrCodeDataUri: string;
  } | null;
}

/**
 * The two-step enrolment: scan (or type) the secret, then prove possession with the first code.
 * On success the recovery codes replace the form — they are the only copy the operator ever sees.
 *
 * The code is entered into per-digit cells; once the sixth digit lands the form submits itself,
 * so the flow needs no button press in the happy path.
 */
export function MfaEnrolForm({ enrolment }: Readonly<MfaEnrolFormProps>) {
  const [state, action, pending] = useActionState(confirmTotpAction, INITIAL_MFA_ENROL_STATE);
  const [code, setCode] = useState('');
  const [, startTransition] = useTransition();
  const codeId = useId();

  // The last digit submits straight away. The action is invoked with FormData built here rather
  // than relying on the hidden input, whose DOM value lags the keystroke that fired onComplete.
  const submitCode = (value: string) => {
    const data = new FormData();
    data.set('code', value);
    startTransition(() => action(data));
  };

  if (state.status === 'enrolled' && state.recoveryCodes) {
    return <RecoveryCodes codes={state.recoveryCodes} />;
  }

  if (!enrolment) {
    return <AlreadyEnrolled />;
  }

  const { secret, qrCodeDataUri } = enrolment;

  return (
    <ol className="mt-10 space-y-5">
      <li
        className="animate-rise rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-5"
        style={{ animationDelay: '120ms' }}
      >
        <div className="flex items-center gap-3">
          <StepNumber value={1} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Add ICB to your authenticator</p>
            <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">
              Scan the code with your authenticator app, or copy the key and enter it manually.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-6">
          {/* A data URI from the API, so next/image's static loader does not apply. */}
          <img
            src={qrCodeDataUri}
            alt="Authenticator setup QR code for ICB Operations"
            className="h-40 w-40 rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-white p-2"
          />
          <SecretValue secret={secret} />
        </div>
      </li>

      <li
        className="animate-rise rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-5"
        style={{ animationDelay: '180ms' }}
      >
        <div className="flex items-center gap-3">
          <StepNumber value={2} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Enter the first code</p>
            <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">
              Type the 6-digit code your app shows — it proves the link worked.
            </p>
          </div>
        </div>
        <form action={action} className="mt-5 space-y-4">
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
            <OTPInput
              id={codeId}
              name="code"
              value={code}
              onChange={setCode}
              onComplete={submitCode}
              invalid={state.status === 'error'}
              className="mt-2"
            />
          </div>
          <Button type="submit" loading={pending} disabled={pending || code.length < 6}>
            {pending ? 'Confirming…' : 'Enable two-factor authentication'}
          </Button>
        </form>
      </li>
    </ol>
  );
}

/** Shown when the API reports the second factor is already on (a fresh visit post-enrolment). */
function AlreadyEnrolled() {
  return (
    <div className="mt-10 animate-rise space-y-6" style={{ animationDelay: '120ms' }}>
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Two-factor authentication is already on for this account.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
      >
        Continue to the console
      </Link>
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

/** The manual-entry fallback, grouped into four-character blocks with a copy button. */
function SecretValue({ secret }: Readonly<{ secret: string }>) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-w-0">
      <p className="text-xs font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
        Manual entry key
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="truncate rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-3 py-2 font-mono text-sm">
          {secret.replace(/(.{4})/g, '$1 ').trim()}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Manual entry key copied' : 'Copy manual entry key'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--icb-border)] text-[var(--icb-text-muted)] transition-colors hover:border-[var(--icb-border-strong)] hover:text-[var(--icb-text)]"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
