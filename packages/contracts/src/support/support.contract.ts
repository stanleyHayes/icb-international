import { z } from 'zod';

import { assetRefSchema, idSchema, isoDateTimeSchema } from '../common/primitives.js';

// ---- Support --------------------------------------------------------------

export const supportTicketSchema = z.object({
  id: idSchema,
  reference: z.string(),
  subject: z.string(),
  category: z.enum(['account', 'card', 'transfer', 'loan', 'technical', 'complaint', 'other']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['open', 'awaiting_customer', 'awaiting_agent', 'resolved', 'closed']),
  assignedTo: z.string().nullable(),
  messageCount: z.int().nonnegative(),
  lastMessageAt: isoDateTimeSchema,
  slaDueAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const supportMessageSchema = z.object({
  id: idSchema,
  ticketId: idSchema,
  author: z.enum(['customer', 'agent', 'system']),
  authorName: z.string(),
  body: z.string(),
  attachments: z.array(assetRefSchema),
  sentAt: isoDateTimeSchema,
});

export const createTicketRequestSchema = z.object({
  subject: z.string().min(4).max(160),
  category: z.enum(['account', 'card', 'transfer', 'loan', 'technical', 'complaint', 'other']),
  body: z.string().min(10).max(4000),
  attachments: z.array(assetRefSchema).max(5).default([]),
});

export const replyToTicketRequestSchema = z.object({
  body: z.string().min(1).max(4000),
  attachments: z.array(assetRefSchema).max(5).default([]),
});

/** CSAT: one rating per ticket, once it is resolved. */
export const satisfactionRequestSchema = z.object({
  rating: z.int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** Signature request for a direct browser → storage attachment upload. Bytes never touch the API. */
export const attachmentUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  sizeBytes: z.int().positive().max(10 * 1024 * 1024),
});

// ---- Callbacks --------------------------------------------------------------

export const callbackWindowSchema = z.enum(['morning', 'afternoon', 'evening', 'any']);
export const callbackStatusSchema = z.enum(['pending', 'completed', 'cancelled']);

export const callbackRequestSchema = z.object({
  phone: z.string().min(5).max(32),
  reason: z.string().min(4).max(500),
  preferredWindow: callbackWindowSchema.default('any'),
  ticketId: z.string().min(1).optional(),
});

export const callbackCompleteRequestSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const staffCallbackQuerySchema = z.object({
  status: callbackStatusSchema.optional(),
});

export const callbackViewSchema = z.object({
  id: idSchema,
  reference: z.string(),
  customerId: idSchema,
  customerName: z.string(),
  phone: z.string(),
  reason: z.string(),
  preferredWindow: callbackWindowSchema,
  ticketId: idSchema.nullable(),
  status: callbackStatusSchema,
  requestedAt: isoDateTimeSchema,
  handledBy: z.string().nullable(),
  handledAt: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
});

// ---- Staff inbox ------------------------------------------------------------

export const inboxQuerySchema = z.object({
  status: supportTicketSchema.shape.status.optional(),
  assignedTo: z.enum(['me', 'unassigned']).optional(),
  slaBreached: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const satisfactionViewSchema = z.object({
  rating: z.int().min(1).max(5),
  comment: z.string().nullable(),
  ratedAt: isoDateTimeSchema,
});

/** The contract ticket plus the operational fields the staff inbox renders. */
export const staffTicketViewSchema = supportTicketSchema.extend({
  customerName: z.string(),
  assignedToName: z.string().nullable(),
  slaBreached: z.boolean(),
  satisfaction: satisfactionViewSchema.nullable(),
});

export type SupportTicket = z.infer<typeof supportTicketSchema>;
export type SupportMessage = z.infer<typeof supportMessageSchema>;
export type SatisfactionRequest = z.infer<typeof satisfactionRequestSchema>;
export type AttachmentUploadRequest = z.infer<typeof attachmentUploadRequestSchema>;
export type CallbackRequest = z.infer<typeof callbackRequestSchema>;
export type CallbackView = z.infer<typeof callbackViewSchema>;
export type StaffCallbackQuery = z.infer<typeof staffCallbackQuerySchema>;
export type InboxQuery = z.infer<typeof inboxQuerySchema>;
export type StaffTicketView = z.infer<typeof staffTicketViewSchema>;
