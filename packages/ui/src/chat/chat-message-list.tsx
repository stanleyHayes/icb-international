'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import type { ChatAuthor, ChatMessage } from '@icb/contracts';

import { cn } from '../lib/cn';
import { formatRelativeDay, formatTime } from '../lib/format';

/**
 * Scrollable chat history. The viewer's own messages sit right in brand colour, everyone
 * else's sit left on a muted bubble; `system` messages centre as quiet one-liners.
 *
 * Bodies render as plain text — never HTML — and the list sticks to the bottom as new
 * messages arrive, like every chat surface people already know.
 */
export function ChatMessageList({
  messages,
  viewerAuthor = 'visitor',
  emptyState,
  className,
}: Readonly<{
  messages: ChatMessage[];
  /** Which author counts as "mine"; their bubbles align right. */
  viewerAuthor?: ChatAuthor;
  /** Rendered in place of the list when there is nothing to show. */
  emptyState?: ReactNode;
  className?: string;
}>) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', className)}>
        {emptyState ?? null}
      </div>
    );
  }

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4', className)}
      aria-live="polite"
      aria-label="Chat messages"
    >
      {messages.map((message) =>
        message.author === 'system' ? (
          <p
            key={message.id}
            className="text-center text-xs text-[var(--icb-text-subtle)]"
          >
            {message.body}
          </p>
        ) : (
          <MessageBubble key={message.id} message={message} own={message.author === viewerAuthor} />
        ),
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({ message, own }: Readonly<{ message: ChatMessage; own: boolean }>) {
  return (
    <div className={cn('flex flex-col', own ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[80%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3 py-2 text-sm',
          own
            ? 'rounded-br-[var(--radius-xs)] bg-[var(--icb-primary)] text-[var(--icb-text-on-brand)]'
            : 'rounded-bl-[var(--radius-xs)] bg-[var(--icb-bg-muted)] text-[var(--icb-text)]',
        )}
      >
        {message.body}
      </div>
      <span className="mt-1 text-xs text-[var(--icb-text-subtle)]">
        {message.authorName} · {formatRelativeDay(message.sentAt)} {formatTime(message.sentAt)}
      </span>
    </div>
  );
}
