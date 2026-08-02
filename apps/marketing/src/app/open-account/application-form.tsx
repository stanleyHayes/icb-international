'use client';

import { Button, Card, CardBody } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId } from 'react';

import { applyAction, type ApplicationState } from './actions';

const INITIAL: ApplicationState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
  signInUrl: null,
};

export function ApplicationForm() {
  const [state, action, pending] = useActionState(applyAction, INITIAL);

  if (state.status === 'submitted') {
    return <ApplicationComplete signInUrl={state.signInUrl} />;
  }

  return (
    <Card>
      <CardBody className="pt-6">
        <form action={action} className="space-y-5" noValidate>
          {state.message ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {state.message}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              name="firstName"
              label="First name"
              autoComplete="given-name"
              error={state.fieldErrors['firstName']}
            />
            <Field
              name="lastName"
              label="Last name"
              autoComplete="family-name"
              error={state.fieldErrors['lastName']}
            />
          </div>

          <Field
            name="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={state.fieldErrors['email']}
          />

          <Field
            name="phone"
            label="Mobile number"
            type="tel"
            autoComplete="tel"
            placeholder="+233201234567"
            hint="Include the country code, e.g. +233 for Ghana."
            error={state.fieldErrors['phone']}
          />

          <Field
            name="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 12 characters, with upper and lower case letters and a digit."
            error={state.fieldErrors['password']}
          />

          <p className="text-xs leading-relaxed text-[var(--icb-text-subtle)]">
            By continuing you accept the ICB terms and privacy notice. We will verify your
            identity before your account can send money — you will be asked for a document and a
            selfie once you sign in.
          </p>

          <Button type="submit" size="lg" block loading={pending}>
            {pending ? 'Opening your account…' : 'Open my account'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  error,
}: Readonly<{
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  error?: string | undefined;
}>) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="mt-1.5 h-11 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ApplicationComplete({ signInUrl }: Readonly<{ signInUrl: string | null }>) {
  return (
    <Card>
      <CardBody className="py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-success-bg)] text-[var(--icb-success-fg)]">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold tracking-[-0.02em]">
          Your account is open
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--icb-text-muted)]">
          Sign in to complete identity verification. Until that is done your account can receive
          money but not send it — the limit is shown on your dashboard.
        </p>
        {signInUrl ? (
          <a
            href={signInUrl}
            className="mt-7 inline-flex h-11 items-center rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-6 text-sm font-medium text-white transition-colors hover:bg-[var(--icb-primary-hover)]"
          >
            Sign in to ICB
          </a>
        ) : null}
      </CardBody>
    </Card>
  );
}
