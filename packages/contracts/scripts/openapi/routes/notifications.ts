import { z } from 'zod';

import {
  notificationPreferenceSchema,
  notificationQuerySchema,
  notificationSchema,
  updateNotificationPreferencesRequestSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const notificationPreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
  quietHours: z
    .object({
      enabled: z.boolean(),
      from: z.string().regex(/^\d{2}:\d{2}$/),
      to: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .nullable(),
});

export const notificationsOperations = defineOperations([
  {
    method: 'get',
    path: '/notifications',
    tag: TAG.notifications,
    operationId: 'listNotifications',
    summary: 'The notification centre feed',
    query: notificationQuerySchema,
    response: success(STATUS.ok, 'A cursor page of notifications.', PAGE_SCHEMAS.NotificationPage),
  },
  {
    method: 'post',
    path: '/notifications/{notificationId}/read',
    tag: TAG.notifications,
    operationId: 'markNotificationRead',
    summary: 'Mark one notification as read',
    pathParams: { notificationId: idSchema },
    response: success(STATUS.ok, 'The updated notification.', notificationSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/notifications/read-all',
    tag: TAG.notifications,
    operationId: 'markAllNotificationsRead',
    summary: 'Mark everything as read',
    response: success(STATUS.noContent, 'All notifications marked as read.'),
  },
  {
    method: 'get',
    path: '/notifications/preferences',
    tag: TAG.notifications,
    operationId: 'getNotificationPreferences',
    summary: 'The per-channel preference matrix',
    response: success(STATUS.ok, 'Preferences and quiet hours.', notificationPreferencesSchema),
  },
  {
    method: 'put',
    path: '/notifications/preferences',
    tag: TAG.notifications,
    operationId: 'updateNotificationPreferences',
    summary: 'Replace the preference matrix',
    request: updateNotificationPreferencesRequestSchema,
    response: success(STATUS.ok, 'The saved preferences.', notificationPreferencesSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
]);
