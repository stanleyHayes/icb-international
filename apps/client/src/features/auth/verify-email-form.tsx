'use client';

import { Button, Field, Input } from '@icb/ui';
import { useActionState } from 'react';

import { FormAlert } from './form-alert';
import { verifyEmailAction, type AuthFormState } from './password-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

/** Confirm an address with the code from the welcome email. */
export function VerifyEmailForm({ token }: Readonly<{ token: string }>) {
  const [state, action, pending] = useActionState(verifyEmailAction, INITIAL);

  if (state.done) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
      >
        Your email address is verified.{' '}
        <a href="/login" className="font-medium underline">
          Sign in
        </a>{' '}
        to continue setting up your account.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />
      <Field
        label="Verification code"
        description="The code from the welcome email, valid for 24 hours."
        error={state.fieldErrors['token']}
        required
      >
        <Input name="token" defaultValue={token} autoComplete="off" required />
      </Field>
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Verifying…' : 'Verify email address'}
      </Button>
    </form>
  );
}
