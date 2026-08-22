'use server';

import { resolveApiBaseUrl } from '@icb/contracts';
import type {
  ChatConversation,
  ChatMessage,
  StartChatResponse,
  WsTicketResponse,
} from '@icb/contracts';

import { ApiError, api } from '@/lib/api';

export type ConnectChatResult =
  | { ok: true; conversation: ChatConversation; messages: ChatMessage[]; wsUrl: string }
  | { ok: false; error: string };

const API_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4100/v1');
const WS_BASE = API_URL.replace(/^http/, 'ws');

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/**
 * Starts (or resumes) the customer's live chat and returns everything the widget needs to
 * open its socket: the conversation, its history, and a ticketed WebSocket URL.
 *
 * Both calls happen server-side, so the access token never reaches the browser (ADR-09) —
 * only the short-lived, conversation-bound WS ticket does.
 */
export async function connectChat(): Promise<ConnectChatResult> {
  try {
    const { conversation, messages } = await api<StartChatResponse>('/chat/conversations', {
      method: 'POST',
      body: {},
      idempotencyKey: crypto.randomUUID(),
    });
    const { ticket } = await api<WsTicketResponse>('/chat/ws-ticket', { method: 'POST' });

    return {
      ok: true,
      conversation,
      messages,
      wsUrl: `${WS_BASE}/chat/ws?ticket=${encodeURIComponent(ticket)}`,
    };
  } catch (error) {
    return { ok: false, error: message(error, 'We could not start the chat. Please try again.') };
  }
}
