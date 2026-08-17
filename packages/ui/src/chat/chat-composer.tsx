'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

import { cn } from '../lib/cn';
import { Button } from '../primitives/button';

/**
 * Message composer: a growing textarea with a send button. Enter sends, Shift+Enter inserts
 * a newline, and the draft clears only after a successful send.
 */
export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = 'Type a message…',
  className,
}: Readonly<{
  /** Return `false` (e.g. socket closed) to keep the draft instead of clearing it. */
  onSend: (body: string) => boolean | void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}>) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const body = draft.trim();
    if (!body || disabled) return;
    const sent = onSend(body);
    if (sent !== false) setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        'flex items-end gap-2 border-t border-[var(--icb-border)] bg-[var(--icb-surface)] p-3',
        className,
      )}
    >
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label="Message"
        className={cn(
          'max-h-32 min-h-10 flex-1 resize-none rounded-[var(--radius-md)] px-3 py-2 text-sm',
          'border border-[var(--icb-border-strong)] bg-[var(--icb-bg)] text-[var(--icb-text)]',
          'placeholder:text-[var(--icb-text-subtle)] disabled:opacity-50',
          'focus:outline-none focus:ring-2 focus:ring-[var(--icb-primary)]',
        )}
      />
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={disabled || draft.trim().length === 0}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
