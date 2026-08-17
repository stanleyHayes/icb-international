import type { Metadata } from 'next';

import { connectChatSocket, getInbox } from '@/features/chat/actions';
import { ChatConsole } from '@/features/chat/chat-console';

export const metadata: Metadata = { title: 'Live chat' };

/**
 * The staff live-chat console.
 *
 * The shell fetches the open-conversation inbox and a WebSocket URL (ticketed, 120s TTL) on
 * the server, then hands both to the client console, which owns the socket, the live inbox,
 * and the selected thread from then on.
 */
export default async function ChatPage() {
  const [conversations, { wsUrl }] = await Promise.all([getInbox(), connectChatSocket()]);

  return <ChatConsole initialConversations={conversations} initialWsUrl={wsUrl} />;
}
