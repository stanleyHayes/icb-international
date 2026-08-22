'use server';

import { resolveApiBaseUrl } from '@icb/contracts';
import type {
  ChatConversation,
  ChatHistoryResponse,
  StaffChatInboxResponse,
  WsTicketResponse,
} from '@icb/contracts';

import { api } from '@/lib/api';

const API_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4100/v1');
const WS_BASE = API_URL.replace(/^http/, 'ws');

/**
 * Staff live-chat server actions.
 *
 * Every call goes through `api()` server-side, so the staff access token never reaches the
 * browser (ADR-09). The only credential the client ever sees is the short-lived WS ticket,
 * which gates the WebSocket handshake and nothing else.
 */

/** The open conversations, latest activity first. */
export async function getInbox(): Promise<ChatConversation[]> {
  const { conversations } = await api<StaffChatInboxResponse>('/chat/staff/inbox');
  return conversations;
}

/** One conversation with its full message history. */
export async function getConversation(id: string): Promise<ChatHistoryResponse> {
  return api<ChatHistoryResponse>(`/chat/staff/conversations/${encodeURIComponent(id)}`);
}

/**
 * Mint an agent-role WS ticket and return the URL the socket should connect to.
 *
 * The ticket lives 120 seconds and is checked only during the handshake; an established
 * socket outlives it. A reconnect after the socket has dropped must call this again for a
 * fresh ticket — the old URL stops working once its ticket expires.
 */
export async function connectChatSocket(): Promise<{ wsUrl: string }> {
  const { ticket } = await api<WsTicketResponse>('/chat/staff/ws-ticket', { method: 'POST' });
  return { wsUrl: `${WS_BASE}/chat/ws?ticket=${encodeURIComponent(ticket)}` };
}

/** Close a conversation; the visitor's widget flips to its closed state. */
export async function closeConversation(id: string): Promise<ChatConversation> {
  return api<ChatConversation>(`/chat/staff/conversations/${encodeURIComponent(id)}/close`, {
    method: 'POST',
  });
}
