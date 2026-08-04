import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { ChannelDecision } from '../domain/channel-selector.js';
import {
  NotificationDeliveryService,
  type DeliveryInput,
} from '../application/notification-delivery.service.js';
import type { NotificationDoc } from '../infrastructure/notification.schemas.js';
import { CUSTOMER_ID, NOTIFICATION_ID, NOW, frozenClock, leanQuery, notificationDoc, rendered } from './fixtures.js';

function decision(overrides: Partial<ChannelDecision> = {}): ChannelDecision {
  return { channel: 'in_app', suppressed: false, reason: null, ...overrides };
}

function input(overrides: Partial<DeliveryInput> = {}): DeliveryInput {
  return {
    customerId: CUSTOMER_ID,
    event: 'transfer_sent',
    decision: decision(),
    rendered: rendered(),
    payload: {},
    recipientEmail: 'ada@example.com',
    recipientPhone: '+447700900123',
    ...overrides,
  };
}

function setup(queued: NotificationDoc = notificationDoc()) {
  const settled = notificationDoc({ state: 'delivered' });
  const model = {
    create: vi.fn().mockResolvedValue([queued]),
    findByIdAndUpdate: vi.fn().mockReturnValue(leanQuery(settled)),
  };
  const transport = { name: 'resend', send: vi.fn().mockResolvedValue({ id: 're_msg_1' }) };
  const service = new NotificationDeliveryService(
    model as unknown as Model<NotificationDoc>,
    transport,
    frozenClock(),
  );
  return { service, model, transport, queued, settled };
}

describe('NotificationDeliveryService.deliver — queueing', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('writes the queued row first, storing the full text body for email only', async () => {
    await deps.service.deliver(input());

    expect(deps.model.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          _id: expect.any(String),
          customerId: CUSTOMER_ID,
          event: 'transfer_sent',
          channel: 'in_app',
          body: 'Transfer sent',
          state: 'queued',
          actionUrl: null,
          createdAt: NOW,
        }),
      ],
      { ordered: true },
    );

    deps.model.create.mockClear();
    await deps.service.deliver(input({ decision: decision({ channel: 'email' }) }));
    expect(deps.model.create).toHaveBeenCalledWith(
      [expect.objectContaining({ body: 'Hello, your transfer was sent.' })],
      { ordered: true },
    );
  });

  it('stores the payload action URL on the queued row', async () => {
    await deps.service.deliver(input({ payload: { actionUrl: '/transfers/1' } }));
    expect(deps.model.create).toHaveBeenCalledWith(
      [expect.objectContaining({ actionUrl: '/transfers/1' })],
      { ordered: true },
    );
  });

  it('throws a conflict when the queued row cannot be recorded', async () => {
    deps.model.create.mockResolvedValue([]);

    await expect(deps.service.deliver(input())).rejects.toThrow(ConflictError);
    expect(deps.model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('throws the typed not-found when the queued row vanishes before settling', async () => {
    deps.model.findByIdAndUpdate.mockReturnValue(leanQuery(null));

    await expect(deps.service.deliver(input())).rejects.toThrow(NotFoundError);
  });
});

describe('NotificationDeliveryService.deliver — channel outcomes', () => {
  it('settles an in-app row as delivered the moment it is written', async () => {
    const deps = setup();

    const result = await deps.service.deliver(input());

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: { state: 'delivered', deliveredAt: NOW } },
      { new: true },
    );
    expect(result).toBe(deps.settled);
    expect(deps.transport.send).not.toHaveBeenCalled();
  });

  it('sends email through the transport and records the provider message id', async () => {
    const deps = setup(notificationDoc({ channel: 'email', attempts: 1 }));

    await deps.service.deliver(input({ decision: decision({ channel: 'email' }) }));

    expect(deps.transport.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@example.com',
        subject: 'Your transfer was sent',
        idempotencyKey: NOTIFICATION_ID,
        tags: [
          { name: 'event', value: 'transfer_sent' },
          { name: 'notification_id', value: NOTIFICATION_ID },
        ],
      }),
    );
    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      {
        $set: {
          state: 'sent',
          recipient: 'ada@example.com',
          providerName: 'resend',
          providerMessageId: 're_msg_1',
          sentAt: NOW,
          attempts: 2,
        },
      },
      { new: true },
    );
  });

  it('prefers the payload recipient override over the address on file', async () => {
    const deps = setup(notificationDoc({ channel: 'email' }));

    await deps.service.deliver(
      input({
        decision: decision({ channel: 'email' }),
        payload: { recipientEmail: 'recovery@example.com' },
      }),
    );

    expect(deps.transport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'recovery@example.com' }),
    );
  });

  it('fails an email with no address on file instead of sending it', async () => {
    const deps = setup(notificationDoc({ channel: 'email' }));

    await deps.service.deliver(
      input({ decision: decision({ channel: 'email' }), recipientEmail: null }),
    );

    expect(deps.transport.send).not.toHaveBeenCalled();
    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: { state: 'failed', failureReason: 'No email address is on file for this customer' } },
      { new: true },
    );
  });

  it('records a transport failure with the provider name and reason', async () => {
    const deps = setup(notificationDoc({ channel: 'email' }));
    deps.transport.send.mockRejectedValue(new Error('Resend rate limited'));

    await deps.service.deliver(input({ decision: decision({ channel: 'email' }) }));

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      {
        $set: {
          state: 'failed',
          recipient: 'ada@example.com',
          providerName: 'resend',
          failureReason: 'Resend rate limited',
          attempts: 1,
        },
      },
      { new: true },
    );
  });

  it('stringifies a non-Error rejection from the transport', async () => {
    const deps = setup(notificationDoc({ channel: 'email' }));
    deps.transport.send.mockRejectedValue('provider exploded');

    await deps.service.deliver(input({ decision: decision({ channel: 'email' }) }));

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: expect.objectContaining({ failureReason: 'provider exploded' }) },
      { new: true },
    );
  });

  it('fails an SMS with no phone number on file', async () => {
    const deps = setup(notificationDoc({ channel: 'sms' }));

    await deps.service.deliver(
      input({ decision: decision({ channel: 'sms' }), recipientPhone: null }),
    );

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: { state: 'failed', failureReason: 'No phone number is on file for this customer' } },
      { new: true },
    );
  });

  it('simulates an SMS delivery with its own provider id', async () => {
    const deps = setup(notificationDoc({ channel: 'sms' }));

    await deps.service.deliver(input({ decision: decision({ channel: 'sms' }) }));

    const [, update] = deps.model.findByIdAndUpdate.mock.calls[0] as [
      string,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set).toMatchObject({
      state: 'delivered',
      recipient: '+447700900123',
      providerName: 'simulated_sms',
      sentAt: NOW,
      deliveredAt: NOW,
      attempts: 1,
    });
    expect(update.$set['providerMessageId']).toMatch(/^sim_/);
  });

  it('simulates a push delivery addressed to the customer', async () => {
    const deps = setup(notificationDoc({ channel: 'push' }));

    await deps.service.deliver(input({ decision: decision({ channel: 'push' }) }));

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: expect.objectContaining({ providerName: 'simulated_push', recipient: CUSTOMER_ID }) },
      { new: true },
    );
  });

  it('settles a quiet-hours suppression with its reason and sends nothing', async () => {
    const deps = setup();

    await deps.service.deliver(
      input({
        decision: decision({ channel: 'sms', suppressed: true, reason: 'Held back by your quiet hours' }),
      }),
    );

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: { state: 'suppressed', failureReason: 'Held back by your quiet hours' } },
      { new: true },
    );
    expect(deps.transport.send).not.toHaveBeenCalled();
  });

  it('settles a reasonless suppression without a failure reason', async () => {
    const deps = setup();

    await deps.service.deliver(input({ decision: decision({ suppressed: true }) }));

    expect(deps.model.findByIdAndUpdate).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      { $set: { state: 'suppressed' } },
      { new: true },
    );
  });
});
