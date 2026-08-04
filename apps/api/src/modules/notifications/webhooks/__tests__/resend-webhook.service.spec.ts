import { createHmac } from 'node:crypto';

import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, ValidationError } from '../../../../common/errors/index.js';
import type { AppConfiguration } from '../../../../config/configuration.js';
import type { NotificationDoc } from '../../infrastructure/notification.schemas.js';
import {
  ResendWebhookService,
  type WebhookDelivery,
} from '../resend-webhook.service.js';
import { CUSTOMER_ID, NOW, frozenClock } from '../../__tests__/fixtures.js';

const SECRET_BASE64 = Buffer.from('a-test-webhook-secret').toString('base64');
const SECRET = `whsec_${SECRET_BASE64}`;
const MESSAGE_ID = 're_msg_1';

function sign(payload: string, id: string, timestamp: string): string {
  const mac = createHmac('sha256', Buffer.from(SECRET_BASE64, 'base64'))
    .update(`${id}.${timestamp}.${payload}`, 'utf8')
    .digest('base64');
  return `v1,${mac}`;
}

function payload(type: string, data: Record<string, unknown> = {}): string {
  return JSON.stringify({ type, data: { email_id: MESSAGE_ID, ...data } });
}

function delivery(body: string, options: { signed?: boolean } = {}): WebhookDelivery {
  if (options.signed !== true) {
    return { payload: body, headers: { id: null, timestamp: null, signature: null } };
  }
  const timestamp = String(Math.floor(NOW.getTime() / 1000));
  return {
    payload: body,
    headers: { id: 'msg-1', timestamp, signature: sign(body, 'msg-1', timestamp) },
  };
}

function record(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: 'notif-1',
    customerId: CUSTOMER_ID,
    state: 'sent',
    providerMessageId: MESSAGE_ID,
    ...overrides,
  } as NotificationDoc;
}

function setup(options: { secret?: string; found?: NotificationDoc | null } = {}) {
  const model = {
    findOne: vi.fn().mockReturnValue({
      lean: () => Promise.resolve(options.found === undefined ? record() : options.found),
    }),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const config = {
    email: { webhookSecret: options.secret ?? '' },
  } as unknown as AppConfiguration;
  const service = new ResendWebhookService(
    model as unknown as Model<NotificationDoc>,
    frozenClock(),
    config,
  );
  return { service, model };
}

describe('ResendWebhookService signature gate', () => {
  it('accepts an unsigned webhook only when no secret is configured', async () => {
    const { service } = setup();
    const outcome = await service.receive(delivery(payload('email.delivered')));
    expect(outcome).toEqual({ received: true, applied: true });
  });

  it('rejects an unsigned webhook when a secret is configured', async () => {
    const { service } = setup({ secret: SECRET });
    await expect(service.receive(delivery(payload('email.delivered')))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('accepts a correctly signed webhook', async () => {
    const { service } = setup({ secret: SECRET });
    const outcome = await service.receive(delivery(payload('email.delivered'), { signed: true }));
    expect(outcome.received).toBe(true);
  });

  it('rejects a signature over a tampered body', async () => {
    const { service } = setup({ secret: SECRET });
    const good = delivery(payload('email.delivered'), { signed: true });
    const tampered: WebhookDelivery = { ...good, payload: payload('email.bounced') };
    await expect(service.receive(tampered)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('ResendWebhookService event handling', () => {
  it('rejects a body that is not JSON', async () => {
    const { service } = setup();
    await expect(service.receive(delivery('not json'))).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects JSON that is not a recognised Resend event', async () => {
    const { service } = setup();
    await expect(service.receive(delivery('{"hello":"world"}'))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('acknowledges but does not apply an event that is not a delivery outcome', async () => {
    const { service, model } = setup();
    const outcome = await service.receive(delivery(payload('email.opened')));

    expect(outcome).toEqual({ received: true, applied: false });
    expect(model.findOne).not.toHaveBeenCalled();
  });

  it('acknowledges an event for a message this bank never sent', async () => {
    const { service } = setup({ found: null });
    const outcome = await service.receive(delivery(payload('email.delivered')));
    expect(outcome).toEqual({ received: true, applied: false });
  });

  it('ignores an out-of-order event that would move the state backwards', async () => {
    const { service, model } = setup({ found: record({ state: 'delivered' }) });
    const outcome = await service.receive(delivery(payload('email.sent')));

    expect(outcome.applied).toBe(false);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('ResendWebhookService folding', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('stamps deliveredAt on a delivery receipt', async () => {
    const outcome = await deps.service.receive(delivery(payload('email.delivered')));

    expect(outcome.applied).toBe(true);
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: 'notif-1' },
      { $set: { state: 'delivered', deliveredAt: NOW } },
    );
  });

  it('records the provider wording on a bounce', async () => {
    await deps.service.receive(
      delivery(payload('email.bounced', { bounce: { message: 'mailbox full' } })),
    );
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: 'notif-1' },
      { $set: { state: 'bounced', failureReason: 'mailbox full' } },
    );
  });

  it('falls back to the bounce type pair when no message is given', async () => {
    await deps.service.receive(
      delivery(payload('email.bounced', { bounce: { type: 'hard', subType: 'blocked' } })),
    );
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: 'notif-1' },
      { $set: expect.objectContaining({ failureReason: 'hard/blocked' }) },
    );
  });

  it('uses the failure reason for a failed event', async () => {
    const queued = setup({ found: record({ state: 'queued' }) });
    await queued.service.receive(
      delivery(payload('email.failed', { failed: { reason: 'recipient rejected' } })),
    );
    expect(queued.model.updateOne).toHaveBeenCalledWith(
      { _id: 'notif-1' },
      { $set: { state: 'failed', failureReason: 'recipient rejected' } },
    );
  });

  it('uses the suppression message for a suppressed event', async () => {
    const queued = setup({ found: record({ state: 'queued' }) });
    await queued.service.receive(
      delivery(payload('email.suppressed', { suppressed: { message: 'unsubscribed' } })),
    );
    expect(queued.model.updateOne).toHaveBeenCalledWith(
      { _id: 'notif-1' },
      { $set: { state: 'suppressed', failureReason: 'unsubscribed' } },
    );
  });
});
