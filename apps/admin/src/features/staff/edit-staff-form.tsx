'use client';

import type { StaffUser } from '@icb/contracts';
import { Button } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState, useId } from 'react';

import { updateStaffAction, type StaffFormState } from './actions';
import { RoleCheckboxes } from './role-checkboxes';

// Kept locally: server-action modules may only export async functions, so this cannot be
// imported from './actions'.
const INITIAL_STAFF_FORM_STATE: StaffFormState = { status: 'idle', message: null, fieldErrors: {} };

/**
 * Role assignment and activation for one operator.
 *
 * Both changes go through the same PATCH. The "active" choice is a pair of radio options rather
 * than a switch: suspending a colleague's access should read as a decision, not a toggle.
 */
export function EditStaffForm({ staff, isSelf }: Readonly<{ staff: StaffUser; isSelf: boolean }>) {
  const [state, action, pending] = useActionState(updateStaffAction, INITIAL_STAFF_FORM_STATE);
  const activeId = useId();
  const banner = statusBanner(state);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="staffId" value={staff.id} />

      {banner}

      <RoleCheckboxes selected={staff.roles} />

      <fieldset>
        <legend className="text-sm font-medium">Access</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <AccessOption
            groupId={activeId}
            value="true"
            label="Active"
            hint="Can sign in and work"
            defaultChecked={staff.active}
          />
          <AccessOption
            groupId={activeId}
            value="false"
            label="Suspended"
            hint={isSelf ? 'You cannot suspend yourself' : 'Sign-in blocked immediately'}
            defaultChecked={!staff.active}
            disabled={isSelf}
          />
        </div>
      </fieldset>

      <Button type="submit" loading={pending}>
        {pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

/** The outcome of the last save attempt: an error banner, a confirmation, or nothing. */
function statusBanner(state: StaffFormState) {
  if (state.message) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        {state.message}
      </p>
    );
  }
  if (state.status === 'saved') {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]"
      >
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Changes saved and written to the audit trail.
      </p>
    );
  }
  return null;
}

function AccessOption({
  groupId,
  value,
  label,
  hint,
  defaultChecked,
  disabled,
}: Readonly<{
  groupId: string;
  value: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
  disabled?: boolean | undefined;
}>) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--icb-border)] px-3.5 py-3 transition-colors has-checked:border-[var(--icb-primary)] has-checked:bg-[var(--icb-navy-50)] has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <input
        type="radio"
        name="active"
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        aria-labelledby={`${groupId}-${value}`}
        className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-full border border-[var(--icb-border-strong)] bg-[var(--icb-surface)] checked:border-[5px] checked:border-[var(--icb-primary)] focus-visible:ring-2 focus-visible:ring-[var(--icb-primary)]"
      />
      <span className="min-w-0">
        <span id={`${groupId}-${value}`} className="block text-sm font-medium">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--icb-text-subtle)]">{hint}</span>
      </span>
    </label>
  );
}
