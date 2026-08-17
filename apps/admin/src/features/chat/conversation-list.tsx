'use client';

import type { ChatConversation } from '@icb/contracts';
import { EmptyState, cn, formatRelativeDay, formatTime } from '@icb/ui';
import { Inbox } from 'lucide-react';

import { visitorLabel } from './visitor-label';

/** The left pane: every open conversation, latest activity first. */
export function ConversationListPane({
  conversations,
  selectedId,
  onSelect,
}: Readonly<{
  conversations: ChatConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}>) {
  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<Inbox size={20} />}
        title="No open chats"
        description="New conversations will appear here the moment a visitor starts one."
      />
    );
  }
  return (
    <ul className="min-h-0 flex-1 divide-y divide-[var(--icb-border)] overflow-y-auto">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          selected={conversation.id === selectedId}
          onSelect={() => onSelect(conversation.id)}
        />
      ))}
    </ul>
  );
}

/** One inbox row: who, the last thing said, and when. */
function ConversationItem({
  conversation,
  selected,
  onSelect,
}: Readonly<{
  conversation: ChatConversation;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'block w-full px-4 py-3 text-left transition-colors hover:bg-[var(--icb-bg-subtle)]',
          selected && 'bg-[var(--icb-bg-subtle)] ring-1 ring-inset ring-[var(--icb-primary)]',
        )}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{visitorLabel(conversation)}</span>
          <span className="shrink-0 text-xs text-[var(--icb-text-subtle)]">
            {conversation.lastMessageAt
              ? `${formatRelativeDay(conversation.lastMessageAt)} ${formatTime(conversation.lastMessageAt)}`
              : formatRelativeDay(conversation.createdAt)}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-xs text-[var(--icb-text-muted)]">
            {conversation.lastMessagePreview ?? 'No messages yet'}
          </span>
          {conversation.status === 'closed' ? (
            <span className="shrink-0 text-xs text-[var(--icb-text-subtle)]">Closed</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
