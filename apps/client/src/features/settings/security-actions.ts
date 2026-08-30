'use server';

import type { DownloadLink } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import type { SettingsActionState } from './profile-actions';

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
