'use client';

import { Field, PasswordInput } from '@icb/ui';
import { useActionState } from 'react';

import { SubmitRow } from './form-parts';
import { changePasswordAction } from './security-actions';
import type { SettingsActionState } from './profile-actions';

const INITIAL: SettingsActionState = { error: null, done: false };

/**
 * Password change. The strength meter on the new password does the teaching; the action does
 * the checking — the API's policy error is surfaced verbatim rather than second-guessed here.
 */
export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <Field label="Current password" required>
        <PasswordInput name="currentPassword" required autoComplete="current-password" showStrengthMeter={false} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" required>
          <PasswordInput name="newPassword" required autoComplete="new-password" />
        </Field>
        <Field label="Repeat new password" required>
          <PasswordInput name="confirmPassword" required autoComplete="new-password" showStrengthMeter={false} />
        </Field>
      </div>
      <SubmitRow pending={pending} label="Change password" state={state} doneText="Password changed." />
    </form>
  );
}
