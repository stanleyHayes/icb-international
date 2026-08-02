import type { NotificationState } from '@icb/contracts';

/**
 * Delivery states only ever move forward.
 *
 * Providers do not promise ordered webhooks: `delivered` can arrive after `bounced`, and a
 * retried `sent` can arrive after either. Ranking the states and refusing to move backwards
 * means the record settles on the furthest thing that actually happened, whatever order the
 * callbacks turn up in.
 */
export const STATE_RANK: Readonly<Record<NotificationState, number>> = {
  queued: 0,
  suppressed: 1,
  failed: 1,
  sent: 2,
  delivered: 3,
  // A bounce or a complaint is the last word on a message, and outranks a delivery receipt.
  bounced: 4,
  complained: 5,
};

function rank(state: string): number {
  return Object.hasOwn(STATE_RANK, state) ? STATE_RANK[state as NotificationState] : -1;
}

export function isForwardTransition(current: string, next: NotificationState): boolean {
  return rank(next) > rank(current);
}
