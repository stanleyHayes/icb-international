import { z } from 'zod';

import { notificationChannelSchema, notificationStateSchema } from '../common/enums.js';
import { cursorQuerySchema } from '../common/pagination.js';
import { idSchema, isoDateTimeSchema } from '../common/primitives.js';

// ---- Notifications --------------------------------------------------------

export const NOTIFICATION_EVENTS = [
  'transfer_sent',
  'transfer_received',
  'transfer_failed',
  'card_transaction',
  'card_declined',
  'low_balance',
  'large_transaction',
  'statement_ready',
  'loan_payment_due',
  'loan_payment_received',
  'bill_due',
  'security_alert',
  'login_new_device',
  'kyc_update',
  'dispute_update',
  'product_update',
] as const;

export const notificationEventSchema = z.enum(NOTIFICATION_EVENTS);

export const notificationSchema = z.object({
  id: idSchema,
  event: notificationEventSchema,
  channel: notificationChannelSchema,
  title: z.string(),
  body: z.string(),
  state: notificationStateSchema,
  actionUrl: z.string().nullable(),
  readAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const notificationPreferenceSchema = z.object({
  event: notificationEventSchema,
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  push: z.boolean(),
});

export const updateNotificationPreferencesRequestSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
  quietHours: z
    .object({
      enabled: z.boolean(),
      from: z.string().regex(/^\d{2}:\d{2}$/),
      to: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

export const notificationQuerySchema = cursorQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
  event: z.array(notificationEventSchema).optional(),
});


export type Notification = z.infer<typeof notificationSchema>;
export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
