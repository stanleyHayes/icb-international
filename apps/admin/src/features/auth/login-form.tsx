'use client';

import { Button } from '@icb/ui';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useActionState, useId, useState } from 'react';

import { loginAction, type LoginState } from './actions';

// Kept locally: server-action modules may only export async functions, so this cannot be
// imported from './actions'.
const INITIAL_LOGIN_STATE: LoginState = {
  error: null,
  fieldErrors: {},
};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL_LOGIN_STATE);
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
