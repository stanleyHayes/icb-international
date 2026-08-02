import type { MoneyDto } from '@icb/contracts';

/**
 * The facts a notification is rendered from.
 *
 * Deliberately a closed, flat shape rather than `Record<string, unknown>`: a template that reads
 * `payload.amount` must be able to trust that it is Money in minor units, and a caller that
 * misspells a key must fail at compile time rather than mail a customer the word "undefined".
 *
 * Every field is optional because one payload type serves sixteen events; each template reads
 * only what it needs and falls back to sensible prose for the rest.
 */
export interface NotificationPayload {
  /** The value that moved. Always integer minor units — never a float. */
  readonly amount?: MoneyDto;
  /** Balance after the event, where the customer would expect to see one. */
  readonly balance?: MoneyDto;
  /** Who the money went to or came from, already masked for display. */
  readonly counterparty?: string;
  /** Which account, as the customer names it ("Everyday Current ••••4021"). */
  readonly accountLabel?: string;
  /** Customer-facing reference, e.g. `TRF-8F3K2M9Q`. */
  readonly reference?: string;
  /** Why something failed or was declined. Shown verbatim. */
  readonly reason?: string;
  readonly merchant?: string;
  readonly device?: string;
  readonly location?: string;
  /** ISO calendar date, e.g. `2026-08-14`. */
  readonly dueDate?: string;
  /** Statement or billing period label, e.g. `July 2026`. */
  readonly period?: string;
  /** Stage or status word for KYC and dispute updates. */
  readonly status?: string;
  /** One extra sentence a template appends after the standard prose. */
  readonly detail?: string;
  /** Deep link into the app. Stored on the in-app record and used as the email CTA. */
  readonly actionUrl?: string;
  /** Overrides the stored address — used by recovery flows that mail an unverified inbox. */
  readonly recipientEmail?: string;
  /** Overrides the stored name in the greeting. */
  readonly recipientName?: string;
}
