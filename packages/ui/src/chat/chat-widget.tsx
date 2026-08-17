'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { MessageCircle, X } from 'lucide-react';

import type { ChatConversation, ChatMessage } from '@icb/contracts';

import { cn } from '../lib/cn';
import { Z_INDEX } from '../layout/layout.constants';
import { Button } from '../primitives/button';
import { ChatComposer } from './chat-composer';
import { ChatMessageList } from './chat-message-list';
import { useChatSocket, type ChatSocketStatus } from './use-chat-socket';

export interface ChatWidgetConnectResult {
  wsUrl: string;
  conversation: ChatConversation;
  messages: ChatMessage[];
}

type ConnectPhase = 'idle' | 'loading' | 'error' | 'ready';

/**
 * The visitor-facing floating chat widget, shared by the marketing and client apps.
 *
 * The launcher sits bottom-right and opens a fixed panel. On first open the app-supplied
 * `connect()` runs — it starts (or resumes) the conversation and hands back the WebSocket
 * URL plus history; from there the widget owns the socket, live messages, and the composer.
 * An optional `gate` renders a pre-chat form (name capture, consent) before the first connect.
 *
 * The panel pops in from the launcher's corner (`icb-pop`, origin bottom-right). There is no
 * exit animation: the panel is conditionally unmounted, and without a transition library an
 * exit cannot be made reliable, so closing is instant.
 */
export function ChatWidget({
  title = 'Chat with us',
  connect,
  gate,
}: Readonly<{
  title?: string;
  connect: () => Promise<ChatWidgetConnectResult>;
  /** Optional pre-chat form; when provided, shown before the first connect. */
  gate?: (start: () => void) => ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(gate === undefined);
  const [phase, setPhase] = useState<ConnectPhase>('idle');
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // `connect` belongs to the app and may be a fresh closure each render; keep it in a ref.
  const connectRef = useRef(connect);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const begin = useCallback(() => {
    setPhase('loading');
    connectRef
      .current()
      .then((result) => {
        setWsUrl(result.wsUrl);
        setConversation(result.conversation);
        setMessages(result.messages);
        setPhase('ready');
      })
      .catch(() => setPhase('error'));
  }, []);

  // Connect once, on the first open after any gate has been passed.
  useEffect(() => {
    if (open && started && phase === 'idle') begin();
  }, [open, started, phase, begin]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((previous) =>
      previous.some((existing) => existing.id === message.id) ? previous : [...previous, message],
    );
  }, []);

  const { status, sendMessage } = useChatSocket({
    wsUrl: phase === 'ready' ? wsUrl : null,
    onMessage: appendMessage,
    onConversation: setConversation,
  });

  const toggle = () => setOpen((value) => !value);

  return (
    <>
      {open ? (
        <ChatPanel
          title={title}
          phase={phase}
          status={status}
          started={started}
          gate={gate}
          conversation={conversation}
          messages={messages}
          onClose={() => setOpen(false)}
          onStart={() => setStarted(true)}
          onRetry={begin}
          onSend={sendMessage}
        />
      ) : null}
      <LauncherButton open={open} title={title} onToggle={toggle} />
    </>
  );
}

function LauncherButton({
  open,
  title,
  onToggle,
}: Readonly<{ open: boolean; title: string; onToggle: () => void }>) {
  const Icon = open ? X : MessageCircle;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Close chat' : title}
      aria-expanded={open}
      style={{ zIndex: Z_INDEX.overlay }}
      className={cn(
        'fixed bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full',
        'bg-[var(--icb-primary)] text-[var(--icb-text-on-brand)] shadow-[var(--shadow-lg)]',
        'transition-transform duration-150 ease-[var(--ease-out)] motion-reduce:transition-none',
        '[@media(hover:hover)]:hover:scale-105 active:scale-95',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

interface ChatPanelProps {
  title: string;
  phase: ConnectPhase;
  status: ChatSocketStatus;
  started: boolean;
  gate: ((start: () => void) => ReactNode) | undefined;
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  onClose: () => void;
  onStart: () => void;
  onRetry: () => void;
  onSend: (body: string, conversationId?: string) => boolean;
}

function ChatPanel({
  title,
  phase,
  status,
  started,
  gate,
  conversation,
  messages,
  onClose,
  onStart,
  onRetry,
  onSend,
}: Readonly<ChatPanelProps>) {
  return (
    <section
      aria-label={title}
      style={{ zIndex: Z_INDEX.overlay }}
      className={cn(
        'fixed bottom-20 right-4 flex flex-col overflow-hidden',
        'h-[min(520px,calc(100dvh-6rem))] w-[min(380px,calc(100vw-2rem))]',
        'rounded-[var(--radius-xl)] border border-[var(--icb-border)]',
        'bg-[var(--icb-surface)] text-[var(--icb-text)] shadow-[var(--shadow-xl)]',
        'origin-bottom-right animate-[icb-pop_var(--icb-duration-normal)_var(--icb-ease-out)_both]',
      )}
    >
      <header className="flex items-center justify-between border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          {phase === 'ready' && status !== 'open' ? (
            <p className="text-xs text-[var(--icb-text-subtle)]" role="status">
              {status === 'connecting' ? 'Connecting…' : 'Disconnected — retrying…'}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded-[var(--radius-sm)] p-1 text-[var(--icb-text-muted)] hover:bg-[var(--icb-bg-muted)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>
      <PanelBody
        phase={phase}
        status={status}
        started={started}
        gate={gate}
        conversation={conversation}
        messages={messages}
        onStart={onStart}
        onRetry={onRetry}
        onSend={onSend}
      />
    </section>
  );
}

function PanelBody({
  phase,
  status,
  started,
  gate,
  conversation,
  messages,
  onStart,
  onRetry,
  onSend,
}: Readonly<Omit<ChatPanelProps, 'title' | 'onClose'>>) {
  if (!started && gate) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{gate(onStart)}</div>
    );
  }
  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--icb-text-muted)]">
        Starting chat…
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-[var(--icb-text-muted)]">
          We couldn't start the chat. Check your connection and try again.
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (conversation?.status === 'closed') {
    return (
      <>
        <ChatMessageList messages={messages} viewerAuthor="visitor" />
        <p className="border-t border-[var(--icb-border)] px-4 py-3 text-center text-sm text-[var(--icb-text-muted)]">
          This chat has been closed.
        </p>
      </>
    );
  }
  return (
    <>
      <ChatMessageList
        messages={messages}
        viewerAuthor="visitor"
        emptyState={
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[var(--icb-text-muted)]">
            No messages yet — say hello and we'll be right with you.
          </div>
        }
      />
      <ChatComposer
        onSend={(body) => onSend(body, conversation?.id)}
        disabled={status !== 'open'}
      />
    </>
  );
}
