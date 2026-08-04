import { SatisfactionNotAllowedError, TicketClosedError } from './support-errors.js';
import type { MessageAuthor, TicketStatus } from './ticket.types.js';

/**
 * Who may touch a thread, and what a reply does to it.
 *
 * Services also enforce ownership in the query filter (a ticket id alone never selects a row);
 * these pure rules are the second layer, so the policy is testable without a database.
 */

/** The principal asking for access: a customer id, or a staff member. */
export interface ThreadCaller {
  readonly customerId: string | null;
  readonly staff: boolean;
}

/** Customers see only their own threads; staff see every thread. */
export function canAccessThread(ticketCustomerId: string, caller: ThreadCaller): boolean {
  return caller.staff || caller.customerId === ticketCustomerId;
}

/** Replies are accepted on anything but a closed ticket. */
export function assertReplyAllowed(ticketId: string, status: TicketStatus): void {
  if (status === 'closed') {
    throw new TicketClosedError(ticketId);
  }
}

/** Who the ball is with after a reply: a customer reply waits on the agent, and vice versa. */
export function statusAfterReply(author: MessageAuthor): TicketStatus {
  return author === 'customer' ? 'awaiting_agent' : 'awaiting_customer';
}

/** The ticket state CSAT is evaluated against. */
export interface SatisfactionTarget {
  readonly _id: string;
  readonly status: TicketStatus;
  readonly satisfaction: unknown;
}

/** CSAT is collected once per ticket, and only after the ticket reached a resolution. */
export function assertSatisfactionAllowed(ticket: SatisfactionTarget): void {
  if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
    throw new SatisfactionNotAllowedError(
      ticket._id,
      'You can rate your experience once the ticket is resolved',
    );
  }
  if (ticket.satisfaction !== null) {
    throw new SatisfactionNotAllowedError(ticket._id, 'This ticket has already been rated');
  }
}
