import { z } from 'zod';
import {
  cursorPageSchema,
  notificationPreferenceSchema,
  notificationQuerySchema,
  notificationSchema,
  updateNotificationPreferencesRequestSchema,
} from '@icb/contracts';

import { get, post, postVoid, put, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

const quietHoursSchema = updateNotificationPreferencesRequestSchema.shape.quietHours;

/** The preference centre view: the per-event matrix plus quiet hours. */
const preferencesViewSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
  quietHours: quietHoursSchema.nullable(),
});

export const notificationsEndpoints = {
  list: get('/notifications', cursorPageSchema(notificationSchema)),
  markRead: post('/notifications/:notificationId/read', notificationSchema, {}),
  markAllRead: postVoid('/notifications/read-all'),
  getPreferences: get('/notifications/preferences', preferencesViewSchema),
  updatePreferences: put('/notifications/preferences', preferencesViewSchema, {
    body: updateNotificationPreferencesRequestSchema,
  }),
};

export function createNotificationsApi(call: Requester) {
  return {
    list: (query?: z.input<typeof notificationQuerySchema>, options?: RequestOptions) =>
      call(notificationsEndpoints.list, { query, options }),
    markRead: (notificationId: string, options?: RequestOptions) =>
      call(notificationsEndpoints.markRead, { params: { notificationId }, options }),
    markAllRead: (options?: RequestOptions) => call(notificationsEndpoints.markAllRead, { options }),
    getPreferences: (options?: RequestOptions) =>
      call(notificationsEndpoints.getPreferences, { options }),
    updatePreferences: (
      body: z.input<typeof updateNotificationPreferencesRequestSchema>,
      options?: RequestOptions,
    ) => call(notificationsEndpoints.updatePreferences, { body, options }),
  };
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
