import { Logger } from '@nestjs/common';

import type { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  EmailTransport,
  type EmailMessage,
  type EmailSendResult,
} from '../domain/email-transport.js';

/**
 * The offline adapter, and the default.
 *
 * Nothing leaves the process. The rendered message is kept in memory and its subject logged, so
 * a developer with no API key still sees exactly which mail the bank decided to send, in order,
 * and a test can assert on the rendered HTML without a network stub.
 *
 * This being the default is a deliberate safety property: a misconfigured environment silently
 * records rather than silently mailing real people from a simulation.
 */
export interface RecordedEmail {
  readonly id: string;
  readonly at: Date;
  readonly message: EmailMessage;
}

/** Bounded so a long-running simulation cannot turn the outbox into a memory leak. */
const MAX_RECORDED = 200;

export class RecordingEmailTransport extends EmailTransport {
  readonly name = 'recording';

  private readonly logger = new Logger(RecordingEmailTransport.name);
  private readonly outbox: RecordedEmail[] = [];
  private sequence = 0;

  constructor(private readonly clock: ClockService) {
    super();
  }

  send(message: EmailMessage): Promise<EmailSendResult> {
    this.sequence += 1;
    const id = `rec_${this.clock.epochMs().toString(36)}_${this.sequence.toString(36)}`;

    this.outbox.push({ id, at: this.clock.now(), message });
    if (this.outbox.length > MAX_RECORDED) {
      this.outbox.shift();
    }

    this.logger.log(
      { messageId: id, to: message.to, subject: message.subject },
      'Email recorded, not sent (no Resend API key configured)',
    );

    return Promise.resolve({ id });
  }

  /** Everything recorded so far, oldest first. */
  list(): readonly RecordedEmail[] {
    return [...this.outbox];
  }

  /** The most recent message to an address, which is what a test almost always wants. */
  lastTo(recipient: string): RecordedEmail | null {
    for (let index = this.outbox.length - 1; index >= 0; index -= 1) {
      const recorded = this.outbox[index];
      if (recorded !== undefined && recorded.message.to === recipient) {
        return recorded;
      }
    }
    return null;
  }

  clear(): void {
    this.outbox.length = 0;
  }
}
