'use server';

import type { NotificationPreference } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import type { SettingsActionState } from './profile-actions';

export interface QuietHoursInput {
  enabled: boolean;
  from: string;
  to: string;
}

export interface NotificationPrefsInput {
  preferences: NotificationPreference[];
  quietHours: QuietHoursInput | null;
}

/**
 * Saves the whole preference matrix in one write. The matrix is edited as a unit — partial
 * saves would leave the server holding a mix of two intentions.
 */
export async function saveNotificationPrefsAction(
  input: NotificationPrefsInput,
): Promise<SettingsActionState> {
  try {
    await api('/notifications/preferences', {
      // The endpoint is a true PUT; the shared api() helper does not declare it in its method
      // union yet (reported to the shell mission), so the literal is narrowed for now.
      method: 'PUT' as unknown as 'POST',
      body: {
        preferences: input.preferences,
        ...(input.quietHours ? { quietHours: input.quietHours } : {}),
      },
    });
    revalidatePath('/settings/notifications');
    return { error: null, done: true };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.problem.detail
        : 'We could not save your notification preferences. Please try again.';
    return { error: message, done: false };
  }
}
