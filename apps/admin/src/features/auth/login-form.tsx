'use client';

import { Button } from '@icb/ui';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { loginAction, verifyMfaAction, type LoginState } from './actions';

// Kept locally: server-action modules may only export async functions, so this cannot be
// imported from './actions'.
const INITIAL_LOGIN_STATE: LoginState = {
  step: 'credentials',
  error: null,
  fieldErrors: {},
  challenge: null,
};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE);

  if (state.step === 'mfa' && state.challenge) {
    return <MfaForm challenge={state.challenge} />;
  }

  return <CredentialsForm state={state} action={action} pending={pending} />;
}

function CredentialsForm({
  state,
  action,
  pending,
}: Readonly<{
  state: LoginState;
  action: (formData: FormData) => void;
  pending: boolean;
}>) {
  const [revealed, setRevealed] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <FormError message={state.error} />

      <div>
        <label htmlFor={emailId} className="block text-sm font-medium">
          Email
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          required
          aria-invalid={Boolean(state.fieldErrors['email']) || undefined}
          aria-describedby={state.fieldErrors['email'] ? `${emailId}-error` : undefined}
          className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
        />
        <FieldError id={`${emailId}-error`} message={state.fieldErrors['email']} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={passwordId} className="block text-sm font-medium">
            Password
          </label>
          <a href="/forgot-password" className="text-xs text-[var(--icb-primary)] hover:underline">
            Forgot password?
          </a>
        </div>
        <div className="relative mt-1.5">
          <input
            id={passwordId}
            name="password"
            type={revealed ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Your password"
            required
            aria-invalid={Boolean(state.fieldErrors['password']) || undefined}
            className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 pr-11 text-sm outline-none focus:border-[var(--icb-primary)]"
          />
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2 text-[var(--icb-text-subtle)] hover:text-[var(--icb-text)]"
          >
            {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <FieldError message={state.fieldErrors['password']} />
      </div>

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-xs text-[var(--icb-text-subtle)]">
        Staff access is audited. Every action is attributed to your account.
      </p>
    </form>
  );
}

function MfaForm({ challenge }: Readonly<{ challenge: NonNullable<LoginState['challenge']> }>) {
  const [state, action, pending] = useActionState(verifyMfaAction, INITIAL_LOGIN_STATE);
  const codeId = useId();

  return (
    <form action={action} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="challengeId" value={challenge.challengeId} />
      <input type="hidden" name="method" value={challenge.method} />
      <input type="hidden" name="expiresAt" value={challenge.expiresAt} />

      <FormError message={state.error} />

      <div>
        <label htmlFor={codeId} className="block text-sm font-medium">
          Verification code
        </label>
        <p className="mt-1 text-xs text-[var(--icb-text-subtle)]">{challengeHint(challenge)}</p>
        <input
          id={codeId}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          required
          minLength={6}
          maxLength={16}
          className="tabular mt-2 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm tracking-[0.3em] outline-none focus:border-[var(--icb-primary)]"
        />
      </div>

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Verifying…' : 'Verify and sign in'}
      </Button>
    </form>
  );
}

/** Where the second-factor code comes from, in one plain sentence. */
function challengeHint(challenge: NonNullable<LoginState['challenge']>): string {
  if (challenge.method !== 'sms') {
    return 'From your authenticator app.';
  }
  return challenge.hint ? `Sent by text message to ${challenge.hint}.` : 'Sent by text message.';
}

function FormError({ message }: Readonly<{ message: string | null }>) {
  if (!message) {
    return null;
  }
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

/** One inline validation message, associated with its input for screen readers. */
function FieldError({
  id,
  message,
}: Readonly<{ id?: string | undefined; message?: string | undefined }>) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
      {message}
    </p>
  );
}
