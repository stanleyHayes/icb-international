import { z } from 'zod';

import { idSchema, isoDateTimeSchema } from '../common/primitives.js';

// ---- Live chat --------------------------------------------------------------

export const chatAuthorSchema = z.enum(['visitor', 'agent', 'system']);

export const chatMessageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  author: chatAuthorSchema,
  /** Display name: the staff member for agents, the given name or 'Guest' for visitors. */
  authorName: z.string(),
  body: z.string().min(1).max(2000),
  sentAt: isoDateTimeSchema,
});

export const chatConversationStatusSchema = z.enum(['open', 'closed']);

export const chatConversationSchema = z.object({
  id: idSchema,
  status: chatConversationStatusSchema,
  /** Null for an anonymous marketing-site visitor. */
  customerId: idSchema.nullable(),
  visitorName: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  closedAt: isoDateTimeSchema.nullable(),
});

/** Anonymous visitors may give a display name; authenticated customers send an empty body. */
export const startChatRequestSchema = z.object({
  visitorName: z.string().min(1).max(80).optional(),
});

/** `visitorToken` lets the visitor resume and authenticate their conversation later. */
export const startChatResponseSchema = z.object({
  conversation: chatConversationSchema,
  visitorToken: z.string(),
  messages: z.array(chatMessageSchema),
});

export const chatHistoryResponseSchema = z.object({
  conversation: chatConversationSchema,
  messages: z.array(chatMessageSchema),
});

export const staffChatInboxResponseSchema = z.object({
  conversations: z.array(chatConversationSchema),
});

/** Short-lived ticket exchanged for the WebSocket upgrade at `wsPath`. */
export const wsTicketResponseSchema = z.object({
  ticket: z.string(),
  wsPath: z.literal('/v1/chat/ws'),
});

// ---- WebSocket frames --------------------------------------------------------

/** Frames the browser sends. Agents must name the conversation; a visitor's socket is bound to one. */
export const chatClientFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    body: z.string().min(1).max(2000),
    conversationId: idSchema.optional(),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

/** Frames the server sends. `conversation` notifies staff of a created or updated conversation. */
export const chatServerFrameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ready'),
    conversationId: idSchema.nullable(),
  }),
  z.object({
    type: z.literal('message'),
    message: chatMessageSchema,
  }),
  z.object({
    type: z.literal('conversation'),
    conversation: chatConversationSchema,
  }),
  z.object({
    type: z.literal('error'),
    message: z.string(),
  }),
  z.object({
    type: z.literal('pong'),
  }),
]);

export type ChatAuthor = z.infer<typeof chatAuthorSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatConversationStatus = z.infer<typeof chatConversationStatusSchema>;
export type ChatConversation = z.infer<typeof chatConversationSchema>;
export type StartChatRequest = z.infer<typeof startChatRequestSchema>;
export type StartChatResponse = z.infer<typeof startChatResponseSchema>;
export type ChatHistoryResponse = z.infer<typeof chatHistoryResponseSchema>;
export type StaffChatInboxResponse = z.infer<typeof staffChatInboxResponseSchema>;
export type WsTicketResponse = z.infer<typeof wsTicketResponseSchema>;
export type ChatClientFrame = z.infer<typeof chatClientFrameSchema>;
export type ChatServerFrame = z.infer<typeof chatServerFrameSchema>;
