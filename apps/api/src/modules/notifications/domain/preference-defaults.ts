import { NOTIFICATION_EVENTS, type NotificationEvent, type NotificationPreference } from '@icb/contracts';

import type { QuietHours } from './preference.types.js';

/**
 * What a customer hears from us before they have said anything.
 *
 * Defaults are opinionated on purpose. A bank that emails every contactless coffee trains people
 * to ignore its mail, so `card_transaction` is push and in-app only; a bank that lets someone
 * miss a failed transfer has cost them money, so that one uses every channel. Silence is never
 * the default for anything that costs money or touches security.
 */

type ChannelDefaults = Omit<NotificationPreference, 'event'>;

const EVERY_CHANNEL: ChannelDefaults = { inApp: true, email: true, sms: true, push: true };
const APP_EMAIL_PUSH: ChannelDefaults = { inApp: true, email: true, sms: false, push: true };
const APP_PUSH: ChannelDefaults = { inApp: true, email: false, sms: false, push: true };
const APP_EMAIL: ChannelDefaults = { inApp: true, email: true, sms: false, push: false };
const APP_ONLY: ChannelDefaults = { inApp: true, email: false, sms: false, push: false };

export const DEFAULT_CHANNELS: Readonly<Record<NotificationEvent, ChannelDefaults>> = {
  transfer_sent: APP_EMAIL_PUSH,
  transfer_received: APP_EMAIL_PUSH,
  transfer_failed: EVERY_CHANNEL,
  card_transaction: APP_PUSH,
  card_declined: APP_EMAIL_PUSH,
  low_balance: APP_EMAIL_PUSH,
  large_transaction: EVERY_CHANNEL,
  statement_ready: APP_EMAIL,
  loan_payment_due: EVERY_CHANNEL,
  loan_payment_received: APP_EMAIL_PUSH,
  bill_due: APP_EMAIL_PUSH,
  security_alert: EVERY_CHANNEL,
  login_new_device: APP_EMAIL_PUSH,
  kyc_update: APP_EMAIL,
  dispute_update: APP_EMAIL_PUSH,
  product_update: APP_ONLY,
};

/**
 * Events a customer cannot switch off, and that ignore quiet hours.
 *
 * Security and failed money movement are not preferences. A customer who has muted everything
 * still finds out that someone signed in from a new device, and still finds out that the rent
 * did not go out — those are duties, not marketing.
 */
export const MANDATORY_EVENTS: ReadonlySet<NotificationEvent> = new Set<NotificationEvent>([
  'security_alert',
  'login_new_device',
  'transfer_failed',
]);

/** Overnight silence is off until asked for; when enabled, this is the window it defaults to. */
export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, from: '22:00', to: '07:00' };

export function defaultPreferences(): NotificationPreference[] {
  return NOTIFICATION_EVENTS.map((event) => ({ event, ...DEFAULT_CHANNELS[event] }));
}

/** In-app and email stay on for mandatory events no matter what the customer stored. */
export function applyMandatoryFloor(preference: NotificationPreference): NotificationPreference {
  if (!MANDATORY_EVENTS.has(preference.event)) {
    return preference;
  }
  return { ...preference, inApp: true, email: true };
}
