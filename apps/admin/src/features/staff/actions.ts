'use server';

import { createStaffUserRequestSchema, staffRoleSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface StaffFormState {
  status: 'idle' | 'error' | 'saved';
  message: string | null;
  fieldErrors: Record<string, string>;
}

// No value exports here: a 'use server' module may only export async functions. The forms
// keep their own initial-state constants.
function toErrorState(error: unknown, fallback: string): StaffFormState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

/**
 * Provision a staff account.
 *
 * Role assignment happens here, at creation, so an account never exists with no answer to
 * "what can this person do?".
 */
export async function createStaffAction(
  _previous: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const parsed = createStaffUserRequestSchema.safeParse({
    email: formData.get('email'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    roles: formData.getAll('roles'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: null,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  try {
    await api('/admin/staff', {
      method: 'POST',
      body: parsed.data,
    });
    revalidatePath('/staff');
    return { status: 'saved', message: null, fieldErrors: {} };
  } catch (error) {
    return toErrorState(error, 'The account could not be created. Please try again.');
  }
}

/** Change a staff member's roles or activation. The API blocks deactivating yourself. */
export async function updateStaffAction(
  _previous: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const staffIdRaw = formData.get('staffId');
  const staffId = typeof staffIdRaw === 'string' ? staffIdRaw : '';
  if (!staffId) {
    return { status: 'error', message: 'Missing staff member.', fieldErrors: {} };
  }

  const roles = formData
    .getAll('roles')
    .map((role) => staffRoleSchema.safeParse(role))
    .filter((result) => result.success)
    .map((result) => result.data);
  const active = formData.get('active') === 'true';

  if (roles.length === 0) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { roles: 'Assign at least one role.' },
    };
  }

  try {
    await api(`/admin/staff/${staffId}`, {
      method: 'PATCH',
      body: { roles, active },
    });
    revalidatePath(`/staff/${staffId}`);
    revalidatePath('/staff');
    return { status: 'saved', message: null, fieldErrors: {} };
  } catch (error) {
    return toErrorState(error, 'The change could not be saved. Please try again.');
  }
}

export interface RevokeSessionState {
  status: 'idle' | 'error' | 'revoked';
  message: string | null;
}

/** Revoke one of the signed-in operator's own sessions. */
export async function revokeSessionAction(
  _previous: RevokeSessionState,
  formData: FormData,
): Promise<RevokeSessionState> {
  const sessionIdRaw = formData.get('sessionId');
  const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw : '';
  if (!sessionId) {
    return { status: 'error', message: 'Missing session.' };
  }

  try {
    await api(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    revalidatePath('/staff');
    return { status: 'revoked', message: null };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError
          ? error.problem.detail
          : 'The session could not be revoked. Please try again.',
    };
  }
}
