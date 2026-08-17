'use server';

import {
  chatHistoryResponseSchema,
  startChatResponseSchema,
  wsTicketResponseSchema,
  type ChatConversation,
  type ChatMessage,
} from '@icb/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/v1';
/** The same base URL with the scheme swapped for the WebSocket upgrade. */
const WS_URL = API_URL.replace(/^http/, 'ws');

/**
 * The connect-ready payload a chat action hands back, or a typed failure the client can show.
 * `status` is the API's HTTP status when there was one — the client uses a 4xx to decide a
 * stored visitor token is dead and should be discarded — and null when the request never
 * reached the API or the response didn't match the contract.
 */
export type ChatActionResult =
  | {
      ok: true;
      wsUrl: string;
      conversation: ChatConversation;
      messages: ChatMessage[];
      visitorToken: string;
    }
  | { ok: false; status: number | null; message: string };

type WsUrlResult =
  | { ok: true; wsUrl: string }
  | { ok: false; status: number | null; message: string };

const GENERIC_MESSAGE = 'We could not start the chat. Please try again.';

/**
 * Mints the short-lived ticket the browser presents when upgrading to the WebSocket
 * (`new WebSocket()` cannot set headers) and folds it into the full connect URL.
 */
async function mintWsUrl(visitorToken: string): Promise<WsUrlResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/chat/ws-ticket`, {
      method: 'POST',
      headers: { authorization: `Bearer ${visitorToken}`, accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: null, message: GENERIC_MESSAGE };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: GENERIC_MESSAGE };
  }

  const parsed = wsTicketResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false, status: null, message: GENERIC_MESSAGE };
  }

  return {
    ok: true,
    wsUrl: `${WS_URL}/chat/ws?ticket=${encodeURIComponent(parsed.data.ticket)}`,
  };
}

/**
 * Starts an anonymous support conversation and returns everything the chat widget needs to
 * connect: history (empty), the visitor token to persist for resuming, and a ticketed
 * WebSocket URL. The visitor name is optional — the API falls back to 'Guest'.
 */
export async function startChat(visitorName?: string): Promise<ChatActionResult> {
  const name = visitorName?.trim();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/chat/conversations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(name ? { visitorName: name } : {}),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: null, message: GENERIC_MESSAGE };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: GENERIC_MESSAGE };
  }

  const parsed = startChatResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false, status: null, message: GENERIC_MESSAGE };
  }

  const ws = await mintWsUrl(parsed.data.visitorToken);
  if (!ws.ok) {
    return ws;
  }

  return { ok: true, wsUrl: ws.wsUrl, ...parsed.data };
}

/**
 * Resumes a stored visitor conversation: fetches its history and mints a fresh WebSocket
 * ticket. A 4xx here means the visitor token is expired or the conversation is gone — the
 * client clears its stored credentials and starts over from the pre-chat gate.
 */
export async function resumeChat(
  visitorToken: string,
  conversationId: string,
): Promise<ChatActionResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/chat/conversations/${encodeURIComponent(conversationId)}`, {
      headers: { authorization: `Bearer ${visitorToken}`, accept: 'application/json' },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: null, message: GENERIC_MESSAGE };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message:
        response.status === 401 || response.status === 403 || response.status === 404
          ? 'Your previous chat session has expired.'
          : GENERIC_MESSAGE,
    };
  }

  const parsed = chatHistoryResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return { ok: false, status: null, message: GENERIC_MESSAGE };
  }

  const ws = await mintWsUrl(visitorToken);
  if (!ws.ok) {
    return ws;
  }

  return { ok: true, wsUrl: ws.wsUrl, visitorToken, ...parsed.data };
}
