'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  chatServerFrameSchema,
  type ChatClientFrame,
  type ChatConversation,
  type ChatMessage,
} from '@icb/contracts';

export type ChatSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface UseChatSocketOptions {
  /** Full WebSocket URL including the ticket query param. `null` means "don't connect yet". */
  wsUrl: string | null;
  onMessage?: (message: ChatMessage) => void;
  onConversation?: (conversation: ChatConversation) => void;
}

export interface UseChatSocketResult {
  status: ChatSocketStatus;
  /** Returns `false` without sending when the socket is not open. */
  sendMessage: (body: string, conversationId?: string) => boolean;
  /** Drop the current socket and reconnect immediately, resetting the backoff. */
  reconnect: () => void;
}

const HEARTBEAT_MS = 30_000;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;

type MessageHandler = ((message: ChatMessage) => void) | undefined;
type ConversationHandler = ((conversation: ChatConversation) => void) | undefined;

/** Parse and validate an inbound frame; anything unrecognised is ignored, never thrown. */
function dispatchServerFrame(
  event: MessageEvent,
  onMessage: MessageHandler,
  onConversation: ConversationHandler,
): void {
  let raw: unknown;
  try {
    raw = JSON.parse(String(event.data));
  } catch {
    return;
  }
  const parsed = chatServerFrameSchema.safeParse(raw);
  if (!parsed.success) return;
  const frame = parsed.data;
  if (frame.type === 'message') onMessage?.(frame.message);
  else if (frame.type === 'conversation') onConversation?.(frame.conversation);
  // 'ready' and 'pong' need no handling; 'error' frames surface via the socket status.
}

function pingIfOpen(socket: WebSocket | null): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'ping' } satisfies ChatClientFrame));
  }
}

/** A close after an error keeps the `error` status so the UI can say which it was. */
function statusAfterClose(previous: ChatSocketStatus): ChatSocketStatus {
  return previous === 'error' ? 'error' : 'closed';
}

/**
 * Live-chat WebSocket lifecycle as a hook: connect on `wsUrl` change, heartbeat every 30s,
 * capped exponential reconnect (1s → 2s → 4s … 15s), and full cleanup on unmount.
 *
 * Inbound frames are validated against `chatServerFrameSchema`; anything unrecognised is
 * ignored rather than thrown, so a newer server never breaks an older client.
 */
export function useChatSocket({
  wsUrl,
  onMessage,
  onConversation,
}: UseChatSocketOptions): UseChatSocketResult {
  const [status, setStatus] = useState<ChatSocketStatus>(wsUrl ? 'connecting' : 'idle');

  const socketRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  // The effect stores its `connect` here so `reconnect()` can reuse the exact same wiring.
  const connectRef = useRef<() => void>(() => {});

  // Callbacks live in refs so a new render closure never retriggers the connection effect.
  const onMessageRef = useRef(onMessage);
  const onConversationRef = useRef(onConversation);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onConversationRef.current = onConversation;
  }, [onMessage, onConversation]);

  const sendMessage = useCallback((body: string, conversationId?: string): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    const frame: ChatClientFrame = { type: 'message', body, conversationId };
    socket.send(JSON.stringify(frame));
    return true;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!wsUrl) {
      setStatus('idle');
      return undefined;
    }

    const clearTimers = () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const startHeartbeat = () => {
      heartbeatRef.current = setInterval(() => pingIfOpen(socketRef.current), HEARTBEAT_MS);
    };

    const connect = () => {
      clearTimers();
      socketRef.current?.close();
      setStatus('connecting');

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) return;
        attemptRef.current = 0;
        setStatus('open');
        startHeartbeat();
      };

      socket.onmessage = (event: MessageEvent) => {
        dispatchServerFrame(event, onMessageRef.current, onConversationRef.current);
      };

      socket.onerror = () => {
        if (mountedRef.current) setStatus('error');
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        clearTimers();
        setStatus(statusAfterClose);
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** attemptRef.current, RECONNECT_MAX_MS);
        attemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    };

    connectRef.current = connect;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimers();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [wsUrl]);

  const reconnect = useCallback(() => {
    if (!wsUrl || !mountedRef.current) return;
    attemptRef.current = 0;
    connectRef.current();
  }, [wsUrl]);

  return { status, sendMessage, reconnect };
}
