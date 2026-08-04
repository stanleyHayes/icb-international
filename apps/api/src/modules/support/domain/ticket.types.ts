import type { SupportMessage, SupportTicket } from '@icb/contracts';

/** Aliases into the contract enums, so the domain never redefines a contract type. */
export type TicketPriority = SupportTicket['priority'];
export type TicketStatus = SupportTicket['status'];
export type TicketCategory = SupportTicket['category'];
export type MessageAuthor = SupportMessage['author'];
