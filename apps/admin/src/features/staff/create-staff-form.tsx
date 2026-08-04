'use client';

import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId } from 'react';

import { STEP_UP_PURPOSE } from '@/features/step-up/step-up.constants';
import { useStepUpSubmit } from '@/features/step-up/use-step-up-submit';

import { createStaffAction, type StaffFormState } from './actions';
import { RoleCheckboxes } from './role-checkboxes';

// Kept locally: server-action modules may only export async functions, so this cannot be
// imported from './actions'.
const INITIAL_STAFF_FORM_STATE: StaffFormState = { status: 'idle', message: null, fieldErrors: {} };

/**
 * Provision a new operator.
 *
 * Creating a login that can touch other people's money is a sensitive operation, so the submit
 * passes through forced re-authentication (step-up) before the API is called.
 */
export function CreateStaffForm() {
  const [state, action, pending] = useActionState(createStaffAction, INITIAL_STAFF_FORM_STATE);
  const stepUp = useStepUpSubmit(STEP_UP_PURPOSE.staffManage, 'Adding a staff member');
  const emailId = useId();
  const firstNameId = useId();
  const lastNameId = useId();

  if (state.status === 'saved') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Staff account created. They must set up two-factor authentication on first sign-in.
      </p>
    );
  }

  return (
    <form
      ref={stepUp.formRef}
      action={action}
      onSubmit={stepUp.handleSubmit}
      className="space-y-5"
      noValidate
    >
      <input type="hidden" name="stepUpToken" ref={stepUp.tokenInputRef} />
      {stepUp.dialog}

      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={firstNameId}
          label="First name"
          name="firstName"
          autoComplete="off"
          error={state.fieldErrors['firstName']}
        />
        <Field
          id={lastNameId}
          label="Last name"
          name="lastName"
          autoComplete="off"
          error={state.fieldErrors['lastName']}
        />
      </div>

      <Field
        id={emailId}
        label="Work email"
        name="email"
        type="email"
        autoComplete="off"
        error={state.fieldErrors['email']}
      />

      <RoleCheckboxes selected={[]} invalid={Boolean(state.fieldErrors['roles'])} />
      {state.fieldErrors['roles'] ? (
        <p className="text-xs text-[var(--icb-danger-fg)]">{state.fieldErrors['roles']}</p>
      ) : (
        <p className="text-xs text-[var(--icb-text-subtle)]">
          At least one role. Permissions come from roles alone — nothing is granted per person.
        </p>
      )}

      <Button type="submit" loading={pending}>
        {pending ? 'Creating…' : 'Create staff account'}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  name,
  type = 'text',
  autoComplete,
  error,
}: Readonly<{
  id: string;
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  error?: string | undefined;
}>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1.5 h-10 w-full rounded-[var(--radius-md)] border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] px-3.5 text-sm outline-none focus:border-[var(--icb-primary)]"
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-[var(--icb-danger-fg)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
