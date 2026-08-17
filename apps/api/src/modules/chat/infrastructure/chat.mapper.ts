import type { ChatConversation, ChatMessage } from '@icb/contracts';

import type { ChatConversationDoc, ChatMessageDoc } from './chat.schemas.js';

/**
 * Document → view mapping. Views carry exactly the contract fields — nothing more, so a schema
 * diff in QA-04 is a real signal rather than noise.
 */

export function toChatConversation(doc: ChatConversationDoc): ChatConversation {
  return {
    id: doc._id,
    status: doc.status as ChatConversation['status'],
    customerId: doc.customerId,
    visitorName: doc.visitorName,
    lastMessagePreview: doc.lastMessagePreview,
    lastMessageAt: doc.lastMessageAt === null ? null : doc.lastMessageAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    closedAt: doc.closedAt === null ? null : doc.closedAt.toISOString(),
  };
}

export function toChatMessage(doc: ChatMessageDoc): ChatMessage {
  return {
    id: doc._id,
    conversationId: doc.conversationId,
    author: doc.author as ChatMessage['author'],
    authorName: doc.authorName,
    body: doc.body,
    sentAt: doc.sentAt.toISOString(),
  };
}
