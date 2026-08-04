'use client';

import { Button, Field, Input, PasswordInput } from '@icb/ui';
import { useActionState } from 'react';

import { FormAlert } from './form-alert';
import { resetPasswordAction, type AuthFormState } from './password-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

/**
 * Choose a new password with the code from the reset email.
 *
 * The token arrives as a code in the customer's inbox rather than a link, so it is typed — or
 * pasted — here. That keeps reset links out of email-scanner caches and browser history.
 */
export function ResetPasswordForm({ token }: Readonly<{ token: string }>) {
  const [state, action, pending] = useActionState(resetPasswordAction, INITIAL);

  if (state.done) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
      >
        Your password is changed, and every other session has been signed out.{' '}
        <a href="/login" className="font-medium underline">
          Sign in with your new password
        </a>
        .
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />

      <Field
        label="Reset code"
        description="The code from the reset email. It expires 60 minutes after it was sent."
        error={state.fieldErrors['token']}
        required
      >
        <Input name="token" defaultValue={token} autoComplete="off" required />
      </Field>

      <Field
        label="New password"
        description="At least 12 characters, with upper and lower case letters and a digit."
        error={state.fieldErrors['password']}
        required
      >
        <PasswordInput name="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm new password" error={state.fieldErrors['confirmPassword']} required>
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          showStrengthMeter={false}
          required
        />
      </Field>

      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Changing…' : 'Change password'}
      </Button>
    </form>
  );
}
