import type { NotificationEvent } from '@icb/contracts';

import type { NotificationPayload } from '../domain/notification-payload.js';

/**
 * Templates are plain functions, not classes and not a rendering framework.
 *
 * A function from facts to `{ subject, html, text }` is trivially unit-testable, has no runtime
 * dependency to mock, and cannot accidentally reach into the database halfway through rendering
 * an email. Every template in the registry has this one signature.
 */

export interface RenderedTemplate {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  /**
   * One line for the notification bell.
   *
   * The same registry serves the in-app channel, and a bell is not an inbox: pasting the full
   * plain-text body — greeting, table, legal footer — into a dropdown is unreadable. Rendering
   * it here keeps the two representations of an event from drifting apart.
   */
  readonly summary: string;
}

export interface TemplateContext {
  readonly payload: NotificationPayload;
  readonly bankName: string;
  /** Greeting name. Falls back to a neutral term of address when the customer has no first name. */
  readonly recipientName: string;
  /** Always clock-derived — templates never read wall time. */
  readonly occurredAt: Date;
}

export type TemplateRenderer = (context: TemplateContext) => RenderedTemplate;

/**
 * Total over `NotificationEvent`: adding an event to the contract breaks the build here until a
 * template exists for it, which is the only reliable way to stop an event shipping unrendered.
 */
export type TemplateRegistry = Readonly<Record<NotificationEvent, TemplateRenderer>>;
