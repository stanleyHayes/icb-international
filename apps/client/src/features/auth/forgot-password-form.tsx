'use client';

import { Button, Field, Input } from '@icb/ui';
import { useActionState } from 'react';

import { FormAlert } from './form-alert';
import { forgotPasswordAction, type AuthFormState } from './password-actions';

const INITIAL: AuthFormState = { error: null, fieldErrors: {}, done: false };

/** Request a reset code. The success copy never confirms the address exists — deliberately. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, INITIAL);

  if (state.done) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
      >
        If that address has an account, a reset code is on its way. It expires in 60 minutes.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormAlert message={state.error} />
      <Field
        label="Email address"
        description="The address you registered with. We will send a reset code there."
        error={state.fieldErrors['email']}
        required
      >
        <Input name="email" type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" size="lg" block loading={pending}>
        {pending ? 'Sending…' : 'Send reset code'}
      </Button>
    </form>
  );
}
