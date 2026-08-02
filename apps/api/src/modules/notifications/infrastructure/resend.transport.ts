import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { DomainError } from '../../../common/errors/domain.error.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import {
  EmailTransport,
  type EmailMessage,
  type EmailSendResult,
} from '../domain/email-transport.js';

/**
 * The real adapter.
 *
 * Resend answers `{ data, error }` rather than throwing, which is easy to ignore and then wonder
 * why nobody received anything — so the one job of this class beyond calling the SDK is to turn
 * a returned error into a thrown `DomainError`. The caller records that as a `failed` delivery
 * with the provider's own wording, which is what support needs to read months later.
 */
export class ResendEmailTransport extends EmailTransport {
  readonly name = 'resend';

  private readonly logger = new Logger(ResendEmailTransport.name);
  private readonly client: Resend;

  constructor(private readonly config: AppConfiguration) {
    super();
    this.client = new Resend(config.email.apiKey);
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const replyTo = message.replyTo ?? this.config.email.replyTo;

    const response = await this.client.emails.send(
      {
        from: this.config.email.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(replyTo === '' ? {} : { replyTo }),
        ...(message.tags === undefined ? {} : { tags: [...message.tags] }),
      },
      // Provider-side idempotency: a retried job re-uses the key and Resend delivers once.
      message.idempotencyKey === undefined ? {} : { idempotencyKey: message.idempotencyKey },
    );

    if (response.error !== null) {
      throw new DomainError('SERVICE_UNAVAILABLE', response.error.message, {
        context: { provider: this.name, providerCode: response.error.name },
      });
    }

    this.logger.log({ messageId: response.data.id, to: message.to }, 'Email handed to Resend');
    return { id: response.data.id };
  }
}
