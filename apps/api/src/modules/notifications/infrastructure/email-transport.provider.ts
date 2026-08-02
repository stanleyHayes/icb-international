import { Logger, type Provider } from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { EMAIL_TRANSPORT, type EmailTransport } from '../domain/email-transport.js';
import { RecordingEmailTransport } from './recording.transport.js';
import { ResendEmailTransport } from './resend.transport.js';

/**
 * Which adapter the bank runs with is decided once, here, from configuration.
 *
 * `config.email.enabled` is derived from the presence of `RESEND_API_KEY`, so the fallback is
 * automatic: clone the repository, run it with no secrets, and every email is rendered and
 * recorded rather than failing. No domain code has ever heard of either adapter.
 */
export const emailTransportProvider: Provider = {
  provide: EMAIL_TRANSPORT,
  inject: [CONFIG, ClockService],
  useFactory: (config: AppConfiguration, clock: ClockService): EmailTransport => {
    const logger = new Logger('EmailTransport');

    if (config.email.enabled) {
      logger.log(`Sending live email through Resend as ${config.email.from}`);
      return new ResendEmailTransport(config);
    }

    logger.warn('RESEND_API_KEY is not set — email is rendered and recorded, never sent');
    return new RecordingEmailTransport(clock);
  },
};
