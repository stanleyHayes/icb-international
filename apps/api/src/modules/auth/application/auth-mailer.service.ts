import { Inject, Injectable } from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import {
  EMAIL_TRANSPORT,
  type EmailMessage,
  type EmailTransport,
} from '../../notifications/domain/email-transport.js';

/**
 * Transactional auth mail: verification links, reset links, and change notices.
 *
 * These are not notifications — the customer never opted in or out of them, and the events do
 * not exist in the notification contract — so they go straight through the email port the
 * notifications module exports. That port binds Resend when a key is present and a recording
 * transport otherwise, so the whole flow runs offline (N2).
 *
 * Templates are deliberately plain: security mail carries no marketing and no images, so that
 * anything flashy in a customer's inbox claiming to be the bank is recognisably fake.
 */
@Injectable()
export class AuthMailerService {
  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transport: EmailTransport,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async sendEmailVerification(to: string, token: string): Promise<void> {
    await this.send({
      to,
      subject: `Verify your ${this.config.bank.name} email address`,
      text: [
        `Welcome to ${this.config.bank.name}.`,
        '',
        'Confirm this email address by entering this verification code in the app:',
        '',
        token,
        '',
        'The code expires in 24 hours. If you did not open an account, ignore this email.',
      ].join('\n'),
      tags: [{ name: 'kind', value: 'email_verification' }],
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    await this.send({
      to,
      subject: `Reset your ${this.config.bank.name} password`,
      text: [
        'We received a request to reset the password on your account.',
        '',
        'Enter this reset code in the app to choose a new password:',
        '',
        token,
        '',
        'The code expires in 60 minutes. If you did not ask for this, ignore this email —',
        'your password stays as it is.',
      ].join('\n'),
      tags: [{ name: 'kind', value: 'password_reset' }],
    });
  }

  async sendPasswordChangedNotice(to: string): Promise<void> {
    await this.send({
      to,
      subject: `Your ${this.config.bank.name} password was changed`,
      text: [
        'The password on your account was just changed, and your other sessions were signed out.',
        '',
        'If this was you, there is nothing to do.',
        'If it was not, reset your password immediately and contact support.',
      ].join('\n'),
      tags: [{ name: 'kind', value: 'password_changed' }],
    });
  }

  private async send(message: Omit<EmailMessage, 'html'>): Promise<void> {
    await this.transport.send({ ...message, html: textToHtml(message.text) });
  }
}

/** Minimal HTML body: paragraphs only — security mail deliberately carries no design. */
function textToHtml(text: string): string {
  const paragraphs = text
    .split('\n\n')
    .map((block) => `<p>${escapeHtml(block).replaceAll('\n', '<br>')}</p>`)
    .join('');
  return `<!doctype html><html><body>${paragraphs}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
