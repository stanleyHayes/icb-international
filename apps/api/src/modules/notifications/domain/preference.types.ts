import type { NotificationPreference, updateNotificationPreferencesRequestSchema } from '@icb/contracts';

/**
 * Preference shapes, derived from the contract rather than restated.
 *
 * `updateNotificationPreferencesRequestSchema` already defines what a customer may send; taking
 * the quiet-hours shape from it with `NonNullable<…>` means the two can never drift, and there
 * is still exactly one declaration of the wire format.
 */

export type UpdatePreferencesRequest = ReturnType<
  typeof updateNotificationPreferencesRequestSchema.parse
>;

export type QuietHours = NonNullable<UpdatePreferencesRequest['quietHours']>;

/** What `GET /notifications/preferences` answers: the full matrix, defaults already applied. */
export interface ResolvedPreferences {
  readonly preferences: readonly NotificationPreference[];
  readonly quietHours: QuietHours;
}
