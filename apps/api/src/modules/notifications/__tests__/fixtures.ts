import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { RenderedTemplate } from '../templates/template.types.js';
import type { NotificationPreferenceDoc } from '../infrastructure/notification-preference.schemas.js';
import type { NotificationDoc } from '../infrastructure/notification.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const CUSTOMER_ID = 'cust-1';
export const NOTIFICATION_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T0';

export function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

export interface LeanQuery {
  sort: () => LeanQuery;
  limit: () => LeanQuery;
  select: () => LeanQuery;
  lean: () => Promise<unknown>;
}

/** A mongoose query chain: every query method returns this, and `lean` settles the value. */
export function leanQuery(result: unknown): LeanQuery {
  const chain = {
    sort: () => chain,
    limit: () => chain,
    select: () => chain,
    lean: () => Promise.resolve(result),
  };
  return chain;
}

export function testConfig(overrides: { webhookSecret?: string } = {}): AppConfiguration {
  return {
    bank: { name: 'ICB', timezone: 'UTC' },
    email: { webhookSecret: overrides.webhookSecret ?? '' },
  } as AppConfiguration;
}

export function rendered(overrides: Partial<RenderedTemplate> = {}): RenderedTemplate {
  return {
    subject: 'Your transfer was sent',
    html: '<p>Hello</p>',
    text: 'Hello, your transfer was sent.',
    summary: 'Transfer sent',
    ...overrides,
  };
}

export function notificationDoc(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: NOTIFICATION_ID,
    customerId: CUSTOMER_ID,
    event: 'transfer_sent',
    channel: 'in_app',
    title: 'Your transfer was sent',
    body: 'Transfer sent',
    state: 'queued',
    actionUrl: null,
    readAt: null,
    recipient: null,
    providerName: null,
    providerMessageId: null,
    payload: {},
    failureReason: null,
    attempts: 0,
    createdAt: NOW,
    sentAt: null,
    deliveredAt: null,
    ...overrides,
  };
}

export function preferenceDoc(
  overrides: Partial<NotificationPreferenceDoc> = {},
): NotificationPreferenceDoc {
  return {
    _id: 'pref-1',
    customerId: CUSTOMER_ID,
    entries: [],
    quietHoursEnabled: false,
    quietHoursFrom: '22:00',
    quietHoursTo: '07:00',
    updatedAtUtc: NOW,
    ...overrides,
  };
}
