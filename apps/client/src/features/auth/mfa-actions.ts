'use server';

import { mfaVerifyRequestSchema, totpConfirmRequestSchema, type RecoveryCodes } from '@icb/contracts';
import { redirect } from 'next/navigation';

import { api, apiRaw, ApiError } from '@/lib/api';

import { establishSession } from './session';

export interface MfaState {
  error: string | null;
}

export type TotpConfirmResult =
  | { ok: true; codes: RecoveryCodes }
  | { ok: false; error: string };

export type DisableResult = { ok: true } | { ok: false; error: string };

interface MfaVerifyPayload {
  tokens: Parameters<typeof establishSession>[1];
  user: Parameters<typeof establishSession>[2];
}

/**
 * Complete the second factor at sign-in.
 *
 * The challenge id arrives from the login step via the URL; the code comes from the form. Both
 * are validated against the shared contract before the API sees them, and the issued session is
 * sealed server-side exactly as a password-only login would be.
 */
export async function verifyMfaAction(_previous: MfaState, formData: FormData): Promise<MfaState> {
  const parsed = mfaVerifyRequestSchema.safeParse({
    challengeId: formData.get('challengeId'),
    code: formData.get('code'),
    trustDevice: formData.get('trustDevice') === 'on',
  });

  if (!parsed.success) {
    return { error: 'Enter the full verification code.' };
  }

  const { response, data } = await apiRaw('/auth/mfa/verify', parsed.data);

  if (!response.ok) {
    const problem = data as { detail?: string } | null;
    return { error: problem?.detail ?? 'The code could not be verified. Please try again.' };
  }

  const payload = data as MfaVerifyPayload;
  await establishSession(response.headers.get('set-cookie'), payload.tokens, payload.user);
  redirect('/');
}

/**
 * Confirm a freshly enrolled authenticator with its first code.
 *
 * Returns the recovery codes on success — the one and only time they exist in readable form —
 * so the enrol screen can show them once and the customer can store them away.
 */
export async function confirmTotpAction(code: string): Promise<TotpConfirmResult> {
  const parsed = totpConfirmRequestSchema.safeParse({ code });
  if (!parsed.success) {
    return { ok: false, error: 'The code from your authenticator is six digits.' };
  }

  try {
    const codes = await api<RecoveryCodes>('/auth/totp/confirm', {
      method: 'POST',
      body: parsed.data,
    });
    return { ok: true, codes };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.problem.detail };
    }
    throw error;
  }
}

/** Switch the authenticator off. Requires a current valid code, same as the API demands. */
export async function disableTotpAction(code: string): Promise<DisableResult> {
  const parsed = totpConfirmRequestSchema.safeParse({ code });
  if (!parsed.success) {
    return { ok: false, error: 'The code from your authenticator is six digits.' };
  }

  try {
    await api<void>('/auth/totp/disable', { method: 'POST', body: parsed.data });
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.problem.detail };
    }
    throw error;
  }
}
