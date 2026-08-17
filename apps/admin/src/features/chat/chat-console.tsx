'use client';

import type { ChatConversation, ChatMessage } from '@icb/contracts';
import { useChatSocket } from '@icb/ui';
import { useCallback, useEffect, useState } from 'react';

import { closeConversation, connectChatSocket, getConversation } from './actions';
import { ConnectionStatus } from './connection-status';
import { ConversationListPane } from './conversation-list';
import { ThreadPane, type ThreadState } from './thread-pane';

const SECTION_CLASS =
  'flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)]';

/**
 * The staff live-chat console: every open conversation on the left, the selected thread on
 * the right.
 *
 * The inbox and history seed from the REST actions; from then on the WebSocket keeps both
 * fresh — `conversation` frames upsert the list (re-sorted latest-first) and `message`
 * frames append to the open thread.
 *
 * Ticket TTL limitation: the WS ticket minted at page load lives 120 seconds and only the
 * handshake checks it, so a connected socket is unaffected. But `useChatSocket`'s automatic
 * backoff reconnect reuses the same URL and therefore fails once the ticket has expired —
 * the operator must use the explicit Reconnect button, which mints a fresh ticket and swaps
 * the URL in (remounting the hook's connection).
 */
export function ChatConsole({
  initialConversations,
  initialWsUrl,
}: Readonly<{
  initialConversations: ChatConversation[];
  initialWsUrl: string;
}>) {
  const [conversations, setConversations] = useState<ChatConversation[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadState, setThreadState] = useState<ThreadState>('idle');
  const [wsUrl, setWsUrl] = useState<string | null>(initialWsUrl);
  const [closing, setClosing] = useState(false);

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  /** Load history whenever the selection changes; stale responses for a previous id are dropped. */
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setThreadState('idle');
      return undefined;
    }
    let cancelled = false;
    setThreadState('loading');
    getConversation(selectedId)
      .then((result) => {
        if (cancelled) return;
        setMessages(result.messages);
        setThreadState('idle');
      })
      .catch(() => {
        if (!cancelled) setThreadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const onConversation = useCallback((conversation: ChatConversation) => {
    setConversations((previous) => {
      const rest = previous.filter((existing) => existing.id !== conversation.id);
      return [conversation, ...rest].sort((a, b) =>
        (b.lastMessageAt ?? b.createdAt).localeCompare(a.lastMessageAt ?? a.createdAt),
      );
    });
  }, []);

  const onMessage = useCallback(
    (message: ChatMessage) => {
      if (message.conversationId !== selectedId) return;
      setMessages((previous) =>
        previous.some((existing) => existing.id === message.id) ? previous : [...previous, message],
      );
    },
    [selectedId],
  );

  const { status, sendMessage } = useChatSocket({ wsUrl, onMessage, onConversation });

  /** Mint a fresh ticket and swap the URL in; the hook reconnects on the change. */
  const reconnectWithFreshTicket = useCallback(() => {
    setWsUrl(null);
    connectChatSocket()
      .then(({ wsUrl: fresh }) => setWsUrl(fresh))
      .catch(() => setWsUrl((current) => current));
  }, []);

  const onClose = useCallback(() => {
    if (!selected || closing) return;
    setClosing(true);
    closeConversation(selected.id)
      .then(onConversation)
      .catch(() => undefined)
      .finally(() => setClosing(false));
  }, [selected, closing, onConversation]);

  // Open conversations fill the list; the selected one stays visible even if just closed.
  const listed = conversations.filter(
    (conversation) => conversation.status === 'open' || conversation.id === selectedId,
  );

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Live chat</h1>
          <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
            {listed.length} open conversation{listed.length === 1 ? '' : 's'}
          </p>
        </div>
        <ConnectionStatus status={status} onReconnect={reconnectWithFreshTicket} />
      </header>

      <div className="mt-6 grid h-[calc(100dvh-15rem)] min-h-[520px] gap-4 lg:grid-cols-[320px_1fr]">
        <section aria-label="Open conversations" className={SECTION_CLASS}>
          <ConversationListPane
            conversations={listed}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section aria-label="Selected conversation" className={SECTION_CLASS}>
          <ThreadPane
            selected={selected}
            threadState={threadState}
            messages={messages}
            socketStatus={status}
            closing={closing}
            onClose={onClose}
            onSend={sendMessage}
          />
        </section>
      </div>
    </>
  );
}
