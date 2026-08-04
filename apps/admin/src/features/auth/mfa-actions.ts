'use server';

import { totpConfirmRequestSchema, type RecoveryCodes } from '@icb/contracts';

import { ApiError, api } from '@/lib/api';
import { updateSessionUser } from '@/lib/session';

export interface MfaEnrolState {
  status: 'idle' | 'error' | 'enrolled';
  message: string | null;
  /** Shown exactly once, after the first code confirms. Never stored in the UI. */
  recoveryCodes: string[] | null;
}

export const INITIAL_MFA_ENROL_STATE: MfaEnrolState = {
  status: 'idle',
  message: null,
  recoveryCodes: null,
};

/**
 * Confirm a TOTP enrolment.
 *
 * The API enables the second factor and returns the recovery codes — the only time they are ever
 * visible. The session's `mfaEnabled` flag is updated here so the console gate opens on the very
 * next navigation, without forcing a fresh sign-in.
 */
export async function confirmTotpAction(
  _previous: MfaEnrolState,
  formData: FormData,
): Promise<MfaEnrolState> {
  const parsed = totpConfirmRequestSchema.safeParse({ code: formData.get('code') });

  if (!parsed.success) {
    return { ...INITIAL_MFA_ENROL_STATE, status: 'error', message: 'Enter the 6-digit code.' };
  }

  try {
    const codes = await api<RecoveryCodes>('/auth/totp/confirm', {
      method: 'POST',
      body: parsed.data,
    });
    await updateSessionUser({ mfaEnabled: true });
    return { status: 'enrolled', message: null, recoveryCodes: codes.codes };
  } catch (error) {
    return {
      ...INITIAL_MFA_ENROL_STATE,
      status: 'error',
      message:
        error instanceof ApiError
          ? error.problem.detail
          : 'The code could not be confirmed. Please try again.',
    };
  }
}
