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


export type SupportTicket = z.infer<typeof supportTicketSchema>;
export type SupportMessage = z.infer<typeof supportMessageSchema>;
