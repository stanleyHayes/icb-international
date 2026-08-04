import { assetRefSchema, supportTicketSchema } from '@icb/contracts';
import type { SupportMessage, SupportTicket } from '@icb/contracts';
import { z } from 'zod';

import {
  ATTACHMENT_CONTENT_TYPES,
  ATTACHMENT_MAX_BYTES,
  INBOX_DEFAULT_LIMIT,
  INBOX_MAX_LIMIT,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '../support.constants.js';

/**
 * Request schemas and staff-side views that `@icb/contracts` does not define yet.
 *
 * The customer-facing ticket/message surface matches the contract exactly; everything here is
 * the staff inbox, macros, callbacks, CSAT and attachment signing. Contract enums are reused
 * via `supportTicketSchema.shape` rather than redefined. Contract request filed with SDK-01 to
 * upstream these.
 */

export const attachmentUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ATTACHMENT_CONTENT_TYPES),
  sizeBytes: z.int().positive().max(ATTACHMENT_MAX_BYTES),
});

export const staffReplyRequestSchema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z.array(assetRefSchema).max(MAX_ATTACHMENTS_PER_MESSAGE).default([]),
  /** Reply and resolve in one action — the common "that should fix it" flow. */
  resolve: z.boolean().default(false),
});

export const updateTicketRequestSchema = z
  .object({
    priority: supportTicketSchema.shape.priority.optional(),
    status: supportTicketSchema.shape.status.optional(),
  })
  .refine((value) => value.priority !== undefined || value.status !== undefined, {
    message: 'At least one of priority or status is required',
  });

export const assignTicketRequestSchema = z
  .object({
    /** Omit to assign the ticket to the caller. */
    staffId: z.string().min(1).optional(),
  })
  .default({});

export const macroCreateRequestSchema = z.object({
  name: z.string().min(2).max(80),
  category: z.string().min(1).max(40).default('general'),
  body: z.string().min(1).max(4000),
});

export const macroUpdateRequestSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  category: z.string().min(1).max(40).optional(),
  body: z.string().min(1).max(4000).optional(),
});

export const callbackRequestSchema = z.object({
  phone: z.string().min(5).max(32),
  reason: z.string().min(4).max(500),
  preferredWindow: z.enum(['morning', 'afternoon', 'evening', 'any']).default('any'),
  ticketId: z.string().min(1).optional(),
});

export const callbackCompleteRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const satisfactionRequestSchema = z.object({
  rating: z.int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const inboxQuerySchema = z.object({
  status: supportTicketSchema.shape.status.optional(),
  assignedTo: z.enum(['me', 'unassigned']).optional(),
  slaBreached: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(INBOX_MAX_LIMIT).default(INBOX_DEFAULT_LIMIT),
});

export const staffCallbackQuerySchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled']).optional(),
});

// ---- Staff-side views ------------------------------------------------------

export interface SatisfactionView {
  rating: number;
  comment: string | null;
  ratedAt: string;
}

/** The contract ticket plus the operational fields the inbox renders. */
export interface StaffTicketView extends SupportTicket {
  customerName: string;
  assignedToName: string | null;
  slaBreached: boolean;
  satisfaction: SatisfactionView | null;
}

export interface StaffTicketDetail {
  ticket: StaffTicketView;
  messages: SupportMessage[];
}

export interface MacroView {
  id: string;
  name: string;
  category: string;
  body: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallbackView {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  phone: string;
  reason: string;
  preferredWindow: string;
  ticketId: string | null;
  status: string;
  requestedAt: string;
  handledBy: string | null;
  handledAt: string | null;
  notes: string | null;
}
