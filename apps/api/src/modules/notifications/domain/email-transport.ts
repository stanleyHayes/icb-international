/**
 * The outbound email port.
 *
 * Everything above this line renders messages; everything below it decides how they leave the
 * building. Binding the port to a recording fake is what lets the whole bank run — and be
 * tested — with no network and no API key, without a single `if (isTest)` inside domain code.
 *
 * Two adapters implement it: `ResendEmailTransport` (real) and `RecordingEmailTransport`
 * (stores and logs, sends nothing). The factory in `email-transport.provider.ts` picks one from
 * `config.email.enabled`, so the choice is made once, at composition time.
 */

/** Injection token. An abstract class alone cannot be injected by interface in Nest. */
export const EMAIL_TRANSPORT = Symbol('ICB_EMAIL_TRANSPORT');

/** A key/value label carried to the provider for analytics and webhook correlation. */
export interface EmailTag {
  readonly name: string;
  readonly value: string;
}

/** A fully rendered message. Transports never render — they only deliver. */
export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly replyTo?: string;
  readonly tags?: readonly EmailTag[];
  /**
   * Provider-level idempotency. Two sends carrying the same key deliver one email, which is what
   * stops a retried job from mailing a customer twice about the same transfer.
   */
  readonly idempotencyKey?: string;
}

/** What a transport promises back: the provider's message id, used to fold webhooks in later. */
export interface EmailSendResult {
  readonly id: string;
}

export abstract class EmailTransport {
  /** Recorded on every notification so the delivery log says which adapter produced the id. */
  abstract readonly name: string;

  abstract send(message: EmailMessage): Promise<EmailSendResult>;
}
