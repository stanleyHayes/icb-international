import { assetRefSchema } from '@icb/contracts';
import type { AssetRef, SupportMessage, SupportTicket } from '@icb/contracts';

import { isSlaBreached } from '../domain/ticket-sla.js';
import type { TicketCategory, TicketPriority, TicketStatus } from '../domain/ticket.types.js';
import type {
  CallbackView,
  MacroView,
  StaffTicketView,
  SatisfactionView,
} from './support-requests.js';
import type {
  SupportCallbackDoc,
  SupportMacroDoc,
  SupportMessageDoc,
  SupportTicketDoc,
} from './support.schemas.js';

/**
 * Document → view mapping. Customer-facing views carry exactly the contract fields — nothing
 * more, so a schema diff in QA-04 is a real signal rather than noise.
 */

export function toSupportTicket(doc: SupportTicketDoc): SupportTicket {
  return {
    id: doc._id,
    reference: doc.reference,
    subject: doc.subject,
    category: doc.category as TicketCategory,
    priority: doc.priority as TicketPriority,
    status: doc.status as TicketStatus,
    assignedTo: doc.assignedTo,
    messageCount: doc.messageCount,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    slaDueAt: doc.slaDueAt === null ? null : doc.slaDueAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toSupportMessage(doc: SupportMessageDoc): SupportMessage {
  return {
    id: doc._id,
    ticketId: doc.ticketId,
    author: doc.author as SupportMessage['author'],
    authorName: doc.authorName,
    body: doc.body,
    attachments: doc.attachments.map((raw): AssetRef => assetRefSchema.parse(raw)),
    sentAt: doc.sentAt.toISOString(),
  };
}

/** The staff inbox row: the contract ticket plus workload and CSAT context. */
export function toStaffTicketView(doc: SupportTicketDoc, now: Date): StaffTicketView {
  return {
    ...toSupportTicket(doc),
    customerName: doc.customerName,
    assignedToName: doc.assignedToName,
    slaBreached: isSlaBreached(doc.status as TicketStatus, doc.slaDueAt, now),
    satisfaction: toSatisfactionView(doc),
  };
}

function toSatisfactionView(doc: SupportTicketDoc): SatisfactionView | null {
  if (doc.satisfaction === null) {
    return null;
  }
  return {
    rating: doc.satisfaction.rating,
    comment: doc.satisfaction.comment,
    ratedAt: doc.satisfaction.ratedAt.toISOString(),
  };
}

export function toMacroView(doc: SupportMacroDoc): MacroView {
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category,
    body: doc.body,
    usageCount: doc.usageCount,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toCallbackView(doc: SupportCallbackDoc): CallbackView {
  return {
    id: doc._id,
    reference: doc.reference,
    customerId: doc.customerId,
    customerName: doc.customerName,
    phone: doc.phone,
    reason: doc.reason,
    preferredWindow: doc.preferredWindow,
    ticketId: doc.ticketId,
    status: doc.status,
    requestedAt: doc.requestedAt.toISOString(),
    handledBy: doc.handledBy,
    handledAt: doc.handledAt === null ? null : doc.handledAt.toISOString(),
    notes: doc.notes,
  };
}
