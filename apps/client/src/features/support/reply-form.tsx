'use client';

import { Button, Field, Textarea } from '@icb/ui';
import { useActionState, useRef } from 'react';

import { replyAction, type SupportActionState } from './actions';
import { SupportFeedback } from './form-feedback';
import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS } from './types';

const INITIAL: SupportActionState = { error: null, done: false };

/**
 * Reply inside a ticket thread. Attachments are optional and travel with the form — the
 * server action requests an upload grant per file and posts the bytes to the storage provider,
 * so nothing sensitive passes through the browser beyond the page itself.
 */
export function ReplyForm({ ticketId }: Readonly<{ ticketId: string }>) {
  const [state, action, pending] = useActionState(replyAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        action(formData);
        formRef.current?.reset();
      }}
      className="space-y-4"
    >
      <input type="hidden" name="ticketId" value={ticketId} />

      <Field label="Your reply" required>
        <Textarea name="body" required maxLength={4000} rows={4} />
      </Field>

      <Field
        label="Attachments"
        description={`Up to ${MAX_ATTACHMENTS} files — images or PDF, 10 MB each.`}
      >
        <input
          type="file"
          name="attachments"
          multiple
          accept={ATTACHMENT_ACCEPT}
          aria-label="Attachments"
          className="block w-full text-sm text-[var(--icb-text-muted)] file:mr-3 file:rounded-[var(--radius-md)] file:border file:border-[var(--icb-border-strong)] file:bg-[var(--icb-surface)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--icb-text)] hover:file:bg-[var(--icb-bg-muted)]"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Send reply
        </Button>
        <SupportFeedback state={state} doneText="Reply sent." />
      </div>
    </form>
  );
}
