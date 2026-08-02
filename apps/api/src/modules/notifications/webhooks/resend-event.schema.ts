import type { NotificationState } from '@icb/contracts';
import { z } from 'zod';

/**
 * The slice of Resend's webhook payload this bank acts on.
 *
 * Parsed with a schema rather than cast, because this arrives on a public endpoint: everything
 * beyond `type` and `data.email_id` is optional, unknown keys are stripped by Zod, and a payload
 * that does not fit is rejected before it can reach a query.
 */
export const resendEventSchema = z.object({
  type: z.string().min(1).max(64),
  created_at: z.string().max(64).optional(),
  data: z.object({
    email_id: z.string().min(1).max(128),
    subject: z.string().max(500).optional(),
    to: z.array(z.string().max(320)).max(50).optional(),
    bounce: z
      .object({
        message: z.string().max(500).optional(),
        type: z.string().max(80).optional(),
        subType: z.string().max(80).optional(),
      })
      .optional(),
    failed: z.object({ reason: z.string().max(500) }).optional(),
    suppressed: z
      .object({ message: z.string().max(500).optional(), type: z.string().max(80).optional() })
      .optional(),
  }),
});

export type ResendEvent = z.infer<typeof resendEventSchema>;

/**
 * Only the six outcomes that change a delivery's story are folded back.
 *
 * `email.opened` and `email.clicked` are deliberately absent: tracking whether a customer opened
 * a security alert is surveillance the bank does not need, and it would churn the record.
 */
export const STATE_BY_TYPE: Readonly<Record<string, NotificationState>> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
};

/** The provider's own wording for why a message did not land, kept verbatim for support. */
export function describeFailure(event: ResendEvent): string | null {
  const { bounce, failed, suppressed } = event.data;
  return bounce?.message ?? failed?.reason ?? suppressed?.message ?? bounceType(bounce) ?? null;
}

function bounceType(bounce: ResendEvent['data']['bounce']): string | null {
  if (bounce?.type === undefined) {
    return null;
  }
  return bounce.subType === undefined ? bounce.type : `${bounce.type}/${bounce.subType}`;
}
