'use client';

import { Button, ChatWidget, Input, type ChatWidgetConnectResult } from '@icb/ui';
import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';

import { resumeChat, startChat } from './actions';

const STORAGE_KEY = 'icb_chat_visitor';

const storedVisitorSchema = z.object({
  visitorToken: z.string(),
  conversationId: z.string(),
});

type StoredVisitor = z.infer<typeof storedVisitorSchema>;

function readStoredVisitor(): StoredVisitor | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = storedVisitorSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function storeVisitor(visitor: StoredVisitor): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visitor));
  } catch {
    // Storage may be unavailable (private mode); the chat still works for this session.
  }
}

function clearStoredVisitor(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * The marketing site's anonymous support chat, floating on every page.
 *
 * The first-ever open shows a pre-chat gate (an optional name and a start button); submitting
 * it runs `startChat`, persists the visitor token, and hands the widget a ready connection.
 * On later visits the stored token drives `resumeChat` instead, so the conversation and its
 * history come back. If the API says the token is dead (4xx), storage is cleared and the
 * widget remounts onto the gate so the visitor can start fresh.
 */
export function SupportChat() {
  const [resetKey, setResetKey] = useState(0);
  // A connection already prepared by the gate's submit, consumed by the first `connect()`.
  const pendingRef = useRef<ChatWidgetConnectResult | null>(null);

  const connect = useCallback(async (): Promise<ChatWidgetConnectResult> => {
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      return pending;
    }

    const stored = readStoredVisitor();
    if (stored) {
      const result = await resumeChat(stored.visitorToken, stored.conversationId);
      if (result.ok) {
        return { wsUrl: result.wsUrl, conversation: result.conversation, messages: result.messages };
      }
      if (result.status !== null && result.status >= 400 && result.status < 500) {
        clearStoredVisitor();
        // Remount the widget so it lands back on the pre-chat gate.
        setResetKey((key) => key + 1);
      }
      throw new Error(result.message);
    }

    throw new Error('No chat session to connect — start a new chat first.');
  }, []);

  const gate = useCallback(
    (start: () => void) => (
      <PreChatForm
        onStarted={(connection) => {
          pendingRef.current = connection;
          start();
        }}
      />
    ),
    [],
  );

  return <ChatWidget key={resetKey} title="Chat with us" connect={connect} gate={gate} />;
}

/**
 * The pre-chat form: an optional display name and a start button. Submitting starts the
 * conversation through the server action, persists the visitor token for future visits, and
 * hands the prepared connection up so the widget skips straight to the socket.
 */
function PreChatForm({
  onStarted,
}: Readonly<{ onStarted: (connection: ChatWidgetConnectResult) => void }>) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await startChat(name);
    if (!result.ok) {
      setError(result.message);
      setSubmitting(false);
      return;
    }

    storeVisitor({ visitorToken: result.visitorToken, conversationId: result.conversation.id });
    onStarted({ wsUrl: result.wsUrl, conversation: result.conversation, messages: result.messages });
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-1 flex-col justify-center gap-4">
      <div>
        <p className="text-sm font-medium">Chat with us</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--icb-text-muted)]">
          Questions about accounts, rates or anything else — a person will answer. No account
          needed.
        </p>
      </div>

      <div>
        <label htmlFor="chat-visitor-name" className="mb-1.5 block text-sm font-medium">
          Your name <span className="font-normal text-[var(--icb-text-subtle)]">(optional)</span>
        </label>
        <Input
          id="chat-visitor-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Guest"
          autoComplete="name"
          maxLength={80}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--icb-danger)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting}>
        {submitting ? 'Starting…' : 'Start chat'}
      </Button>
    </form>
  );
}
