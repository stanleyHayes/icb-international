'use client';

import { Button, Checkbox, Field, Textarea } from '@icb/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useActionState } from 'react';

import { replyAction } from './ticket-actions';
import { IDLE_STATE } from './types';

/**
 * The secure-message reply.
 *
 * Replies travel over the secure-message channel — never email — because ticket threads can
 * carry account detail. "Reply and resolve" exists because it is the common case, but it is an
 * explicit tick, never the default.
 */
export function ReplyForm({ ticketId }: Readonly<{ ticketId: string }>) {
  const [state, action, pending] = useActionState(replyAction, IDLE_STATE);

  if (state.status === 'done') {
    return (
      <p className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-success-border)] bg-[var(--icb-success-bg)] px-4 py-3 text-sm text-[var(--icb-success-fg)]">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
        Reply sent to the customer&rsquo;s secure messages.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />

      {state.message ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--icb-danger-border)] bg-[var(--icb-danger-bg)] px-4 py-3 text-sm text-[var(--icb-danger-fg)]"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <Field
        label="Reply"
        error={state.fieldErrors['body']}
        description="Delivered as a secure message inside the customer's banking app."
      >
        <Textarea name="body" rows={5} required placeholder="Write to the customer…" />
      </Field>

      <Checkbox
        name="resolve"
        label="Resolve this ticket when the reply is sent"
      />

      <Button type="submit" loading={pending}>
        {pending ? 'Sending…' : 'Send reply'}
      </Button>
    </form>
  );
}
