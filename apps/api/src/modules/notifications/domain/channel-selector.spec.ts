import type { NotificationEvent, NotificationPreference } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { selectChannels } from './channel-selector.js';
import { defaultPreferences } from './preference-defaults.js';
import type { QuietHours } from './preference.types.js';
import { isWithinQuietHours } from './quiet-hours.js';

/** UTC+0 all year, so a local-time expectation is unambiguous. */
const ZONE = 'Africa/Accra';
const QUIET: QuietHours = { enabled: true, from: '22:00', to: '07:00' };
const NIGHT = new Date(Date.UTC(2026, 7, 2, 23, 30));
const MIDDAY = new Date(Date.UTC(2026, 7, 2, 12, 0));

const DEFAULTS = new Map(defaultPreferences().map((entry) => [entry.event, entry]));

function preferenceFor(event: NotificationEvent): NotificationPreference {
  const found = DEFAULTS.get(event);
  if (found === undefined) {
    throw new Error(`no default preference for ${event}`);
  }
  return found;
}

function muted(event: NotificationEvent): NotificationPreference {
  return { event, inApp: false, email: false, sms: false, push: false };
}

describe('isWithinQuietHours', () => {
  it('covers a window that wraps midnight', () => {
    expect(isWithinQuietHours(QUIET, NIGHT, ZONE)).toBe(true);
    expect(isWithinQuietHours(QUIET, new Date(Date.UTC(2026, 7, 2, 3, 0)), ZONE)).toBe(true);
  });

  it('is open outside the window, and at the exact end of it', () => {
    expect(isWithinQuietHours(QUIET, MIDDAY, ZONE)).toBe(false);
    expect(isWithinQuietHours(QUIET, new Date(Date.UTC(2026, 7, 2, 7, 0)), ZONE)).toBe(false);
  });

  it('reads the window in local time rather than UTC', () => {
    // 23:30 UTC is 19:30 in New York — a customer there is not asleep yet.
    expect(isWithinQuietHours(QUIET, NIGHT, 'America/New_York')).toBe(false);
  });

  it('silences nothing when disabled or zero-length', () => {
    expect(isWithinQuietHours({ ...QUIET, enabled: false }, NIGHT, ZONE)).toBe(false);
    expect(isWithinQuietHours({ enabled: true, from: '08:00', to: '08:00' }, NIGHT, ZONE)).toBe(
      false,
    );
  });
});

describe('selectChannels', () => {
  it('holds back interruptive channels during quiet hours but never the in-app list', () => {
    const decisions = selectChannels({
      event: 'card_transaction',
      preference: preferenceFor('card_transaction'),
      quietHours: QUIET,
      at: NIGHT,
      timeZone: ZONE,
    });

    expect(decisions.map((decision) => [decision.channel, decision.suppressed])).toEqual([
      ['in_app', false],
      ['push', true],
    ]);
    expect(decisions[1]?.reason).toBe('Held back by your quiet hours');
  });

  it('sends everything when quiet hours are not in force', () => {
    const decisions = selectChannels({
      event: 'card_transaction',
      preference: preferenceFor('card_transaction'),
      quietHours: QUIET,
      at: MIDDAY,
      timeZone: ZONE,
    });

    expect(decisions.every((decision) => !decision.suppressed)).toBe(true);
  });

  it('ignores quiet hours for a security alert', () => {
    const decisions = selectChannels({
      event: 'security_alert',
      preference: preferenceFor('security_alert'),
      quietHours: QUIET,
      at: NIGHT,
      timeZone: ZONE,
    });

    expect(decisions).toHaveLength(4);
    expect(decisions.every((decision) => !decision.suppressed)).toBe(true);
  });

  it('still reaches a customer who muted a mandatory event', () => {
    const decisions = selectChannels({
      event: 'security_alert',
      preference: muted('security_alert'),
      quietHours: { ...QUIET, enabled: false },
      at: NIGHT,
      timeZone: ZONE,
    });

    expect(decisions.map((decision) => decision.channel)).toEqual(['in_app', 'email']);
  });

  it('stays silent for an optional event the customer switched off', () => {
    const decisions = selectChannels({
      event: 'product_update',
      preference: muted('product_update'),
      quietHours: { ...QUIET, enabled: false },
      at: MIDDAY,
      timeZone: ZONE,
    });

    expect(decisions).toEqual([]);
  });

  it('never emails a card authorisation by default', () => {
    const decisions = selectChannels({
      event: 'card_transaction',
      preference: preferenceFor('card_transaction'),
      quietHours: { ...QUIET, enabled: false },
      at: MIDDAY,
      timeZone: ZONE,
    });

    expect(decisions.map((decision) => decision.channel)).not.toContain('email');
  });
});
