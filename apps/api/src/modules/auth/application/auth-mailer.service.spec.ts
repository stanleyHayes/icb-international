import { describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import type { EmailMessage, EmailTransport } from '../../notifications/domain/email-transport.js';
import { AuthMailerService } from './auth-mailer.service.js';

function setup() {
  const transport: Pick<EmailTransport, 'send'> = { send: vi.fn().mockResolvedValue({ id: 'm-1' }) };
  const config = { bank: { name: 'International Commercial Bank' } } as AppConfiguration;
  const mailer = new AuthMailerService(transport as EmailTransport, config);
  return { transport, mailer };
}

function sentMessage(transport: Pick<EmailTransport, 'send'>): EmailMessage {
  const send = transport.send as ReturnType<typeof vi.fn>;
  return send.mock.calls[0]?.[0] as EmailMessage;
}

describe('AuthMailerService', () => {
  it('sends the verification token to the new customer', async () => {
    const { transport, mailer } = setup();

    await mailer.sendEmailVerification('ama@example.com', 'tok-123');

    const message = sentMessage(transport);
    expect(message.to).toBe('ama@example.com');
    expect(message.text).toContain('tok-123');
    expect(message.html).toContain('tok-123');
    expect(message.subject).toContain('International Commercial Bank');
  });

  it('sends the reset token with its expiry and a no-op escape hatch', async () => {
    const { transport, mailer } = setup();

    await mailer.sendPasswordReset('ama@example.com', 'tok-456');

    const message = sentMessage(transport);
    expect(message.text).toContain('tok-456');
    expect(message.text).toContain('60 minutes');
  });

  it('sends a change notice carrying no token at all', async () => {
    const { transport, mailer } = setup();

    await mailer.sendPasswordChangedNotice('ama@example.com');

    const message = sentMessage(transport);
    expect(message.text).toContain('password');
    expect(message.text).not.toContain('tok-');
  });

  it('escapes HTML in the rendered body', async () => {
    const { transport, mailer } = setup();

    await mailer.sendEmailVerification('ama@example.com', '<script>alert(1)</script>');

    expect(sentMessage(transport).html).not.toContain('<script>');
  });
});
