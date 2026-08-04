'use client';

import { Button, Checkbox, Field, Input, PasswordInput, PhoneInput } from '@icb/ui';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { FormAlert } from './form-alert';
import type { AuthFormState } from './password-actions';
import { signupAction } from './signup-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

/** The terms version the customer asserts to. Bumped when the terms materially change. */
const TERMS_VERSION = '1.0';

/**
 * Opening an account, part one: who you are and how you will sign in.
 *
 * The success state is not a dashboard — registration deliberately does not create a session.
 * The next thing the customer must do is in their inbox, so that is what the screen says.
 */
export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, INITIAL);
  const [phone, setPhone] = useState('');

  if (state.done) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
        >
          <MailCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Your account is created. We sent a verification code to your email — enter it to
            confirm the address, then sign in to finish setting up.
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            href="/verify-email"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--icb-primary)] px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--icb-primary-hover)]"
          >
            Enter verification code
          </Link>
          <Link
            href="/login"
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] px-4 text-sm font-medium text-[var(--icb-text-muted)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />
      <input type="hidden" name="acceptedTermsVersion" value={TERMS_VERSION} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" error={state.fieldErrors['firstName']} required>
          <Input name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Last name" error={state.fieldErrors['lastName']} required>
          <Input name="lastName" autoComplete="family-name" required />
        </Field>
      </div>

      <Field label="Email address" error={state.fieldErrors['email']} required>
        <Input name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Mobile number"
        description="Used for security codes. Include the country code, e.g. +233201234567."
        error={state.fieldErrors['phone']}
        required
      >
        <PhoneInput value={phone} onChange={setPhone} required />
      </Field>
      <input type="hidden" name="phone" value={phone} />

      <Field
        label="Password"
        description="At least 12 characters, with upper and lower case letters and a digit."
        error={state.fieldErrors['password']}
        required
      >
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm password" error={state.fieldErrors['confirmPassword']} required>
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          showStrengthMeter={false}
          required
        />
      </Field>

      <div>
        <Checkbox
          name="terms"
          label="I agree to the account terms and the privacy notice"
          invalid={Boolean(state.fieldErrors['terms'])}
        />
        {state.fieldErrors['terms'] ? (
          <p role="alert" className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
            {state.fieldErrors['terms']}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Opening your account…' : 'Open account'}
      </Button>
    </form>
  );
}
