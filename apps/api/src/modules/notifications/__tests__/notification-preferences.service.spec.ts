import type { NotificationPreference } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationPreferencesService } from '../application/notification-preferences.service.js';
import { DEFAULT_QUIET_HOURS } from '../domain/preference-defaults.js';
import type { NotificationPreferenceDoc } from '../infrastructure/notification-preference.schemas.js';
import { CUSTOMER_ID, NOW, frozenClock, leanQuery, preferenceDoc } from './fixtures.js';

function entry(event: string, channels: Partial<Omit<NotificationPreference, 'event'>> = {}) {
  return { event, inApp: true, email: true, sms: true, push: true, ...channels };
}

function setup(stored: NotificationPreferenceDoc | null = null) {
  const model = {
    findOne: vi.fn().mockReturnValue(leanQuery(stored)),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
  const service = new NotificationPreferencesService(
    model as unknown as Model<NotificationPreferenceDoc>,
    frozenClock(),
  );
  return { service, model };
}

describe('NotificationPreferencesService.resolve', () => {
  it('answers the code defaults for a customer who never touched the screen', async () => {
    const { service } = setup(null);

    const resolved = await service.resolve(CUSTOMER_ID);

    expect(resolved.preferences).toHaveLength(16);
    expect(resolved.preferences.find((p) => p.event === 'card_transaction')).toEqual({
      event: 'card_transaction',
      inApp: true,
      email: false,
      sms: false,
      push: true,
    });
    expect(resolved.quietHours).toEqual(DEFAULT_QUIET_HOURS);
  });

  it('layers a stored override over the default for that event only', async () => {
    const stored = preferenceDoc({
      entries: [entry('transfer_sent', { email: false, push: false })],
    });
    const { service } = setup(stored);

    const resolved = await service.resolve(CUSTOMER_ID);

    expect(resolved.preferences.find((p) => p.event === 'transfer_sent')).toEqual(
      entry('transfer_sent', { email: false, push: false }),
    );
    // Untouched events keep their defaults.
    expect(resolved.preferences.find((p) => p.event === 'statement_ready')).toEqual({
      event: 'statement_ready',
      inApp: true,
      email: true,
      sms: false,
      push: false,
    });
  });

  it('forces in-app and email back on for a mandatory event the customer switched off', async () => {
    const stored = preferenceDoc({
      entries: [entry('security_alert', { inApp: false, email: false, sms: false, push: false })],
    });
    const { service } = setup(stored);

    const resolved = await service.resolve(CUSTOMER_ID);

    expect(resolved.preferences.find((p) => p.event === 'security_alert')).toEqual({
      event: 'security_alert',
      inApp: true,
      email: true,
      sms: false,
      push: false,
    });
  });

  it('returns the stored quiet hours when a document exists', async () => {
    const stored = preferenceDoc({ quietHoursEnabled: true, quietHoursFrom: '21:30', quietHoursTo: '06:45' });
    const { service } = setup(stored);

    const resolved = await service.resolve(CUSTOMER_ID);

    expect(resolved.quietHours).toEqual({ enabled: true, from: '21:30', to: '06:45' });
  });
});

describe('NotificationPreferencesService.forEvent', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(null);
  });

  it('resolves the default row without materialising the whole matrix', async () => {
    const { preference, quietHours } = await deps.service.forEvent(CUSTOMER_ID, 'transfer_failed');

    expect(preference).toEqual({
      event: 'transfer_failed',
      inApp: true,
      email: true,
      sms: true,
      push: true,
    });
    expect(quietHours).toEqual(DEFAULT_QUIET_HOURS);
  });

  it('picks the stored row for the event when one exists', async () => {
    const { service } = setup(
      preferenceDoc({
        entries: [
          entry('bill_due', { sms: true }),
          entry('card_transaction', { push: false }),
        ],
        quietHoursEnabled: true,
      }),
    );

    const { preference, quietHours } = await service.forEvent(CUSTOMER_ID, 'card_transaction');

    expect(preference).toEqual(entry('card_transaction', { push: false }));
    expect(quietHours.enabled).toBe(true);
  });

  it('applies the mandatory floor to a stored row for a mandatory event', async () => {
    const { service } = setup(
      preferenceDoc({ entries: [entry('login_new_device', { inApp: false, email: false })] }),
    );

    const { preference } = await service.forEvent(CUSTOMER_ID, 'login_new_device');

    expect(preference.inApp).toBe(true);
    expect(preference.email).toBe(true);
  });
});

describe('NotificationPreferencesService.update', () => {
  it('upserts the merged overlay and stamps it with the frozen clock', async () => {
    const stored = preferenceDoc({ entries: [entry('bill_due', { email: false })] });
    const { service, model } = setup(stored);

    await service.update(CUSTOMER_ID, {
      preferences: [entry('card_transaction', { push: false }) as NotificationPreference],
    });

    expect(model.updateOne).toHaveBeenCalledWith(
      { customerId: CUSTOMER_ID },
      {
        $set: {
          entries: [entry('bill_due', { email: false }), entry('card_transaction', { push: false })],
          quietHoursEnabled: false,
          quietHoursFrom: '22:00',
          quietHoursTo: '07:00',
          updatedAtUtc: NOW,
        },
        $setOnInsert: { _id: expect.any(String), customerId: CUSTOMER_ID },
      },
      { upsert: true },
    );
  });

  it('overwrites an existing entry for the same event rather than duplicating it', async () => {
    const stored = preferenceDoc({ entries: [entry('bill_due', { email: false })] });
    const { service, model } = setup(stored);

    await service.update(CUSTOMER_ID, {
      preferences: [entry('bill_due', { email: true }) as NotificationPreference],
    });

    const [, update] = model.updateOne.mock.calls[0] as [
      unknown,
      { $set: { entries: unknown[] } },
    ];
    expect(update.$set.entries).toEqual([entry('bill_due', { email: true })]);
  });

  it('applies the mandatory floor to rows being written', async () => {
    const { service, model } = setup(null);

    await service.update(CUSTOMER_ID, {
      preferences: [
        entry('security_alert', { inApp: false, email: false, sms: true }) as NotificationPreference,
      ],
    });

    const [, update] = model.updateOne.mock.calls[0] as [
      unknown,
      { $set: { entries: unknown[] } },
    ];
    expect(update.$set.entries).toEqual([
      entry('security_alert', { inApp: true, email: true, sms: true }),
    ]);
  });

  it('keeps the stored quiet hours when the request does not mention them', async () => {
    const stored = preferenceDoc({ quietHoursEnabled: true, quietHoursFrom: '23:00', quietHoursTo: '05:00' });
    const { service, model } = setup(stored);

    await service.update(CUSTOMER_ID, { preferences: [] });

    expect(model.updateOne).toHaveBeenCalledWith(
      { customerId: CUSTOMER_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          quietHoursEnabled: true,
          quietHoursFrom: '23:00',
          quietHoursTo: '05:00',
        }),
      }),
      { upsert: true },
    );
  });

  it('writes the submitted quiet hours and returns the resolved matrix', async () => {
    const { service, model } = setup(null);

    const resolved = await service.update(CUSTOMER_ID, {
      preferences: [],
      quietHours: { enabled: true, from: '20:00', to: '08:00' },
    });

    expect(model.updateOne).toHaveBeenCalledWith(
      { customerId: CUSTOMER_ID },
      expect.objectContaining({
        $set: expect.objectContaining({ quietHoursEnabled: true, quietHoursFrom: '20:00' }),
      }),
      { upsert: true },
    );
    // resolve() reads the (unmodified) store afterwards, so the matrix itself is default-shaped.
    expect(resolved.preferences).toHaveLength(16);
  });
});
