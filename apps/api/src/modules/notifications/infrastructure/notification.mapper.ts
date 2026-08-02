import type {
  Notification,
  NotificationChannel,
  NotificationEvent,
  NotificationPreference,
  NotificationState,
} from '@icb/contracts';

import type { PreferenceEntry } from './notification-preference.schemas.js';
import type { NotificationDoc } from './notification.schemas.js';

/**
 * Persistence → contract.
 *
 * Note what does not cross: `payload`, `providerMessageId`, `recipient`, `failureReason`. Those
 * are the bank's operational record, not the customer's. Leaving the mapping in one place is
 * what makes that omission a decision rather than an accident of whichever query ran.
 */

export function toNotification(doc: NotificationDoc): Notification {
  return {
    id: doc._id,
    event: doc.event as NotificationEvent,
    channel: doc.channel as NotificationChannel,
    title: doc.title,
    body: doc.body,
    state: doc.state as NotificationState,
    actionUrl: doc.actionUrl,
    readAt: doc.readAt === null ? null : doc.readAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toPreference(entry: PreferenceEntry): NotificationPreference {
  return {
    event: entry.event as NotificationEvent,
    inApp: entry.inApp,
    email: entry.email,
    sms: entry.sms,
    push: entry.push,
  };
}

export function toPreferenceEntry(preference: NotificationPreference): PreferenceEntry {
  return {
    event: preference.event,
    inApp: preference.inApp,
    email: preference.email,
    sms: preference.sms,
    push: preference.push,
  };
}
