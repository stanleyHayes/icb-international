import { type z } from 'zod';
import {
  chatConversationSchema,
  chatHistoryResponseSchema,
  staffChatInboxResponseSchema,
  startChatRequestSchema,
  startChatResponseSchema,
  wsTicketResponseSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const chatEndpoints = {
  startChat: post('/chat/conversations', startChatResponseSchema, {
    body: startChatRequestSchema,
    auth: false,
  }),
  getHistory: get('/chat/conversations/:conversationId', chatHistoryResponseSchema),
  staffInbox: get('/chat/staff/inbox', staffChatInboxResponseSchema),
  staffCloseConversation: post(
    '/chat/staff/conversations/:conversationId/close',
    chatConversationSchema,
    {},
  ),
  mintWsTicket: post('/chat/ws-ticket', wsTicketResponseSchema, {}),
};

export function createChatApi(call: Requester) {
  return {
    startChat: (body: z.input<typeof startChatRequestSchema>, options?: RequestOptions) =>
      call(chatEndpoints.startChat, { body, options }),
    getHistory: (conversationId: string, options?: RequestOptions) =>
      call(chatEndpoints.getHistory, { params: { conversationId }, options }),
    staffInbox: (options?: RequestOptions) => call(chatEndpoints.staffInbox, { options }),
    staffCloseConversation: (conversationId: string, options?: RequestOptions) =>
      call(chatEndpoints.staffCloseConversation, { params: { conversationId }, options }),
    mintWsTicket: (options?: RequestOptions) => call(chatEndpoints.mintWsTicket, { options }),
  };
}

export type ChatApi = ReturnType<typeof createChatApi>;
