import { describe, expect, it } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { createEmailTransport } from './email-transport.provider.js';
import { RecordingEmailTransport } from './recording.transport.js';
import { ResendEmailTransport } from './resend.transport.js';

function configWith(email: Partial<AppConfiguration['email']>): AppConfiguration {
  return {
    email: {
      apiKey: '',
      from: 'ICB <no-reply@icb.example>',
      replyTo: 'support@icb.example',
      webhookSecret: '',
      enabled: false,
      ...email,
    },
  } as unknown as AppConfiguration;
}

describe('createEmailTransport', () => {
  it('binds the recording transport when no API key is configured', () => {
    const transport = createEmailTransport(configWith({}), new ClockService());

    expect(transport).toBeInstanceOf(RecordingEmailTransport);
    expect(transport.name).toBe('recording');
  });

  it('binds Resend once a key is present', () => {
    const transport = createEmailTransport(
      configWith({ apiKey: 're_test_key', enabled: true }),
      new ClockService(),
    );

    expect(transport).toBeInstanceOf(ResendEmailTransport);
    expect(transport.name).toBe('resend');
  });
});

describe('RecordingEmailTransport', () => {
  const message = {
    to: 'ama@example.com',
    subject: 'You sent $1,250.00',
    html: '<p>hello</p>',
    text: 'hello',
  };

  it('returns a provider id and keeps the rendered message', async () => {
    const clock = new ClockService();
    clock.freeze(new Date(Date.UTC(2026, 7, 2, 12, 0, 0)));
    const transport = new RecordingEmailTransport(clock);

    const first = await transport.send(message);
    const second = await transport.send({ ...message, subject: 'Second' });

    expect(first.id).not.toBe(second.id);
    expect(transport.list()).toHaveLength(2);
    expect(transport.lastTo('ama@example.com')?.message.subject).toBe('Second');
    expect(transport.lastTo('someone@example.com')).toBeNull();
  });

  it('clears its outbox on request', async () => {
    const transport = new RecordingEmailTransport(new ClockService());
    await transport.send(message);

    transport.clear();

    expect(transport.list()).toEqual([]);
  });

  it('stays bounded so a long simulation cannot leak memory', async () => {
    const transport = new RecordingEmailTransport(new ClockService());

    for (let index = 0; index < 260; index += 1) {
      await transport.send({ ...message, subject: `Message ${index}` });
    }

    expect(transport.list()).toHaveLength(200);
    expect(transport.list()[199]?.message.subject).toBe('Message 259');
  });
});
