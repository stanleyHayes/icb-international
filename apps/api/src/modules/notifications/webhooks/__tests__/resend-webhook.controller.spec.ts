import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResendWebhookController } from '../resend-webhook.controller.js';
import { type ResendWebhookService, type WebhookOutcome } from '../resend-webhook.service.js';

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer | string };

const OUTCOME: WebhookOutcome = { received: true, applied: true };

function requestDouble(overrides: Record<string, unknown> = {}): RawBodyRequest {
  return { body: { type: 'email.delivered' }, ...overrides } as unknown as RawBodyRequest;
}

describe('ResendWebhookController', () => {
  let webhooks: { receive: ReturnType<typeof vi.fn> };
  let controller: ResendWebhookController;

  beforeEach(() => {
    webhooks = { receive: vi.fn().mockResolvedValue(OUTCOME) };
    controller = new ResendWebhookController(webhooks as unknown as ResendWebhookService);
  });

  it('prefers the string raw body and reads the standard webhook headers', async () => {
    const result = await controller.receive(requestDouble({ rawBody: '{"signed":true}' }), {
      'webhook-id': 'msg-1',
      'webhook-timestamp': '1754301600',
      'webhook-signature': 'v1,abc',
    });

    expect(webhooks.receive).toHaveBeenCalledWith({
      payload: '{"signed":true}',
      headers: { id: 'msg-1', timestamp: '1754301600', signature: 'v1,abc' },
    });
    expect(result).toBe(OUTCOME);
  });

  it('decodes a Buffer raw body and accepts the legacy svix header spelling', async () => {
    await controller.receive(requestDouble({ rawBody: Buffer.from('{"a":1}') }), {
      'svix-id': 'msg-2',
      'svix-timestamp': '1754301601',
      'svix-signature': 'v1,def',
    });

    expect(webhooks.receive).toHaveBeenCalledWith({
      payload: '{"a":1}',
      headers: { id: 'msg-2', timestamp: '1754301601', signature: 'v1,def' },
    });
  });

  it('re-serialises the parsed body when rawBody is unavailable', async () => {
    await controller.receive(requestDouble(), {});

    expect(webhooks.receive).toHaveBeenCalledWith({
      payload: '{"type":"email.delivered"}',
      headers: { id: null, timestamp: null, signature: null },
    });
  });

  it('serialises an empty object when neither rawBody nor body exists', async () => {
    await controller.receive(requestDouble({ body: undefined }), {});

    expect(webhooks.receive).toHaveBeenCalledWith(
      expect.objectContaining({ payload: '{}' }),
    );
  });

  it('takes the first value of a multi-valued header', async () => {
    await controller.receive(requestDouble(), {
      'webhook-id': ['msg-3', 'msg-4'],
    });

    expect(webhooks.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ id: 'msg-3' }),
      }),
    );
  });

  it('maps an empty multi-valued header to null', async () => {
    await controller.receive(requestDouble(), { 'webhook-id': [] });

    expect(webhooks.receive).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({ id: null }),
      }),
    );
  });
});
