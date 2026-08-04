import {
  MS_PER_HOUR,
  OPEN_TICKET_STATUSES,
  SLA_HOURS_BY_PRIORITY,
} from '../support.constants.js';
import type { TicketPriority, TicketStatus } from './ticket.types.js';

/**
 * First-response SLA.
 *
 * The deadline is stored on the ticket at creation (and recomputed when staff change priority),
 * so a breach is a pure comparison against the simulation clock — no timers, and time travel
 * simply makes more tickets overdue.
 */

/** The first-response deadline for a ticket filed at `from` with the given priority. */
export function slaDeadline(priority: TicketPriority, from: Date): Date {
  return new Date(from.getTime() + SLA_HOURS_BY_PRIORITY[priority] * MS_PER_HOUR);
}

/** A ticket breaches its SLA only while it is still open — resolving stops the clock. */
export function isSlaBreached(status: TicketStatus, slaDueAt: Date | null, now: Date): boolean {
  if (slaDueAt === null || !OPEN_TICKET_STATUSES.includes(status)) {
    return false;
  }
  return slaDueAt.getTime() < now.getTime();
}
