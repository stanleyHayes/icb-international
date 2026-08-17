import {
  chatConversationSchema,
  chatHistoryResponseSchema,
  staffChatInboxResponseSchema,
  startChatRequestSchema,
  startChatResponseSchema,
  wsTicketResponseSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const CONVERSATION_ID = { conversationId: idSchema } as const;

export const chatOperations = defineOperations([
  {
    method: 'post',
    path: '/chat/conversations',
    tag: TAG.chat,
    operationId: 'startChat',
    summary: 'Start a live-chat conversation (anonymous visitors and customers)',
    request: startChatRequestSchema,
    auth: false,
    response: success(STATUS.created, 'The conversation and its resume token.', startChatResponseSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'get',
    path: '/chat/conversations/{conversationId}',
    tag: TAG.chat,
    operationId: 'getChatHistory',
    summary: 'A conversation and its full message history',
    pathParams: CONVERSATION_ID,
    response: success(STATUS.ok, 'The conversation history, oldest first.', chatHistoryResponseSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'get',
    path: '/chat/staff/inbox',
    tag: TAG.chat,
    operationId: 'listStaffChatInbox',
    summary: 'Open chat conversations awaiting an agent (staff)',
    response: success(STATUS.ok, 'The open conversations.', staffChatInboxResponseSchema),
  },
  {
    method: 'post',
    path: '/chat/staff/conversations/{conversationId}/close',
    tag: TAG.chat,
    operationId: 'closeChatConversation',
    summary: 'Close a conversation (staff)',
    pathParams: CONVERSATION_ID,
    response: success(STATUS.ok, 'The closed conversation.', chatConversationSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict }],
  },
  {
    method: 'post',
    path: '/chat/ws-ticket',
    tag: TAG.chat,
    operationId: 'mintChatWsTicket',
    summary: 'Mint the short-lived ticket exchanged for the WebSocket upgrade',
    response: success(STATUS.ok, 'The ticket and the WebSocket path.', wsTicketResponseSchema),
  },
]);
