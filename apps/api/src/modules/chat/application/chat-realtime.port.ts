import type { ChatConversation, ChatMessage } from '@icb/contracts';

/**
 * How the chat service reaches live sockets without knowing the transport.
 *
 * Implemented by `ChatGateway`. The port exists so the service can announce lifecycle events —
 * a conversation starting or closing — while the message broadcasts themselves stay next to the
 * frame handler that persisted the message.
 */
export abstract class ChatRealtimePort {
  /** A brand-new conversation; staff sockets refresh their inbox. */
  abstract conversationStarted(conversation: ChatConversation): void;

  /** Staff closed the conversation; the visitor room and staff hear about it. */
  abstract conversationClosed(
    conversationId: string,
    message: ChatMessage,
    conversation: ChatConversation,
  ): void;
}
