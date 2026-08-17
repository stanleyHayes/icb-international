'use client';

import type { ChatConversation, ChatMessage } from '@icb/contracts';
import {
  Button,
  ChatComposer,
  ChatMessageList,
  EmptyState,
  StatusBadge,
  type ChatSocketStatus,
} from '@icb/ui';
import { MessageCircle, XCircle } from 'lucide-react';

import { visitorLabel } from './visitor-label';

export type ThreadState = 'idle' | 'loading' | 'error';

interface ThreadPaneProps {
  selected: ChatConversation | null;
  threadState: ThreadState;
  messages: ChatMessage[];
  socketStatus: ChatSocketStatus;
  closing: boolean;
  onClose: () => void;
  onSend: (body: string, conversationId?: string) => boolean;
}

/** The right pane: thread header with the close action, history, and the composer. */
export function ThreadPane({
  selected,
  threadState,
  messages,
  socketStatus,
  closing,
  onClose,
  onSend,
}: Readonly<ThreadPaneProps>) {
  if (!selected) {
    return (
      <EmptyState
        icon={<MessageCircle size={20} />}
        title="Select a chat"
        description="Pick a conversation on the left to see the thread and reply."
      />
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <p className="truncate text-sm font-medium">{visitorLabel(selected)}</p>
          <StatusBadge status={selected.status} />
        </div>
        {selected.status === 'open' ? (
          <Button variant="secondary" size="sm" onClick={onClose} loading={closing}>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            Close chat
          </Button>
        ) : null}
      </header>

      <ThreadBody threadState={threadState} messages={messages} />

      {selected.status === 'closed' ? (
        <p className="border-t border-[var(--icb-border)] px-4 py-3 text-center text-sm text-[var(--icb-text-muted)]">
          This chat has been closed.
        </p>
      ) : (
        <ChatComposer
          onSend={(body) => onSend(body, selected.id)}
          disabled={socketStatus !== 'open'}
          placeholder="Reply to the visitor…"
        />
      )}
    </>
  );
}

/** History for the open conversation: a quiet note while loading or on failure. */
function ThreadBody({
  threadState,
  messages,
}: Readonly<Pick<ThreadPaneProps, 'threadState' | 'messages'>>) {
  if (threadState !== 'idle') {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[var(--icb-text-muted)]">
        {threadState === 'loading'
          ? 'Loading conversation…'
          : 'The conversation could not be loaded. Select it again to retry.'}
      </div>
    );
  }
  return (
    <ChatMessageList
      messages={messages}
      viewerAuthor="agent"
      emptyState={
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[var(--icb-text-muted)]">
          No messages in this conversation yet.
        </div>
      }
    />
  );
}
