'use server';

import type { DownloadLink, RecoveryCodes, totpEnrolResponseSchema } from '@icb/contracts';
import { revalidatePath, revalidateTag } from 'next/cache';
import type { z } from 'zod';

import { ApiError, api } from '@/lib/api';

import type { SettingsActionState } from './profile-actions';

export type TotpEnrolment = z.infer<typeof totpEnrolResponseSchema>;

export interface TotpEnrolState {
  error: string | null;
  enrolment: TotpEnrolment | null;
}

export interface TotpConfirmState {
  error: string | null;
  codes: RecoveryCodes | null;
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/** Changes the password. The API revokes nothing on its own — sessions rotate naturally. */
export async function changePasswordAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const currentPassword = formData.get('currentPassword');
  const newPassword = formData.get('newPassword');
  const confirm = formData.get('confirmPassword');

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword === '') {
    return { error: 'Enter your current password and a new one.', done: false };
  }
  if (newPassword !== confirm) {
    return { error: 'The new passwords do not match.', done: false };
  }

  try {
    await api('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    return { error: null, done: true };
  } catch (error) {
    return { error: message(error, 'We could not change your password. Please try again.'), done: false };
  }
}

/** Starts TOTP enrolment: the API returns the secret and a QR code to scan. */
export async function totpEnrolAction(): Promise<TotpEnrolState> {
  try {
    const enrolment = await api<TotpEnrolment>('/auth/totp/enrol', { method: 'POST' });
    return { error: null, enrolment };
  } catch (error) {
    return { error: message(error, 'We could not start set-up. Please try again.'), enrolment: null };
  }
}

/** Confirms enrolment with the first code from the authenticator; returns recovery codes. */
export async function totpConfirmAction(code: string): Promise<TotpConfirmState> {
  try {
    const codes = await api<RecoveryCodes>('/auth/totp/confirm', {
      method: 'POST',
      body: { code },
    });
    revalidateTag('profile', 'max');
    revalidatePath('/settings/security');
    return { error: null, codes };
  } catch (error) {
    return { error: message(error, 'That code did not match. Check the time on your device and try again.'), codes: null };
  }
}

/** Disables TOTP, authenticated by a current code from the authenticator. */
export async function totpDisableAction(code: string): Promise<SettingsActionState> {
  try {
    await api('/auth/totp/disable', { method: 'POST', body: { code } });
    revalidatePath('/settings/security');
    return { error: null, done: true };
  } catch (error) {
    return { error: message(error, 'That code did not match. Two-factor authentication is still on.'), done: false };
  }
}

/** Revokes one session — the remote-wipe for a device the customer no longer recognises. */
export async function revokeSessionAction(sessionId: string): Promise<SettingsActionState> {
  try {
    await api(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
    revalidatePath('/settings/security');
    return { error: null, done: true };
  } catch (error) {
    return { error: message(error, 'We could not end that session. Please try again.'), done: false };
  }
}

export interface ExportState {
  error: string | null;
  link: DownloadLink | null;
}

/** Requests the full data export; the API returns a signed, expiring download link. */
export async function exportDataAction(): Promise<ExportState> {
  try {
    const link = await api<DownloadLink>('/customers/me/export', {
      method: 'POST',
      idempotencyKey: crypto.randomUUID(),
    });
    return { error: null, link };
  } catch (error) {
    return { error: message(error, 'We could not prepare your export. Please try again.'), link: null };
  }
}
