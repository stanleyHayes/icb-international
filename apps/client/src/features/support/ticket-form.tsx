'use client';

import { Button, Field, Input, Select, Textarea } from '@icb/ui';
import { useActionState } from 'react';

import { createTicketAction, type SupportActionState } from './actions';
import { SupportFeedback } from './form-feedback';
import { TICKET_CATEGORIES } from './types';

const INITIAL: SupportActionState = { error: null, done: false };

/**
 * New secure message. One message opens a ticket; the conversation then continues in the
 * thread, which carries the account context so the customer never re-explains who they are.
 */
export function TicketForm({
  defaultCategory,
}: Readonly<{ defaultCategory?: string | undefined }>) {
  const [state, action, pending] = useActionState(createTicketAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <Field label="Subject" required>
        <Input
          name="subject"
          required
          minLength={4}
          maxLength={160}
          placeholder="What is this about?"
        />
      </Field>

      <Field label="Topic" required>
        <Select name="category" required defaultValue={defaultCategory ?? 'account'}>
          {TICKET_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Your message"
        required
        description="Never include your password, PIN or full card number — we will never ask for them."
      >
        <Textarea name="body" required minLength={10} maxLength={4000} rows={6} />
      </Field>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={pending}>
          Send message
        </Button>
        <SupportFeedback state={state} doneText="Sent." />
      </div>
    </form>
  );
}
