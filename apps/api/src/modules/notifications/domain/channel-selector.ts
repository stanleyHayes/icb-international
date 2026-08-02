import type { NotificationChannel, NotificationEvent, NotificationPreference } from '@icb/contracts';

import { MANDATORY_EVENTS, applyMandatoryFloor } from './preference-defaults.js';
import type { QuietHours } from './preference.types.js';
import { isWithinQuietHours } from './quiet-hours.js';

/**
 * Which channels an event goes out on, and which are held back.
 *
 * A channel the customer turned off produces no record at all — they asked not to be told. A
 * channel held back by quiet hours *does* produce a record, in state `suppressed`, because the
 * bank still has to be able to answer "why didn't I get the text?" months later.
 */

export interface ChannelDecision {
  readonly channel: NotificationChannel;
  readonly suppressed: boolean;
  readonly reason: string | null;
}

/** In-app is a list the customer opens, not an interruption, so quiet hours never hold it back. */
const INTERRUPTIVE: readonly NotificationChannel[] = ['email', 'sms', 'push'];

const QUIET_HOURS_REASON = 'Held back by your quiet hours';

export interface SelectionInput {
  readonly event: NotificationEvent;
  readonly preference: NotificationPreference;
  readonly quietHours: QuietHours;
  readonly at: Date;
  readonly timeZone: string;
}

export function selectChannels(input: SelectionInput): ChannelDecision[] {
  const preference = applyMandatoryFloor(input.preference);
  const mandatory = MANDATORY_EVENTS.has(input.event);
  const quiet =
    !mandatory && isWithinQuietHours(input.quietHours, input.at, input.timeZone);

  return enabledChannels(preference).map((channel) => ({
    channel,
    suppressed: quiet && INTERRUPTIVE.includes(channel),
    reason: quiet && INTERRUPTIVE.includes(channel) ? QUIET_HOURS_REASON : null,
  }));
}

function enabledChannels(preference: NotificationPreference): NotificationChannel[] {
  const enabled: NotificationChannel[] = [];
  if (preference.inApp) {
    enabled.push('in_app');
  }
  if (preference.email) {
    enabled.push('email');
  }
  if (preference.sms) {
    enabled.push('sms');
  }
  if (preference.push) {
    enabled.push('push');
  }
  return enabled;
}
