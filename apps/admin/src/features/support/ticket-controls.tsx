'use client';

import type { SupportTicket } from '@icb/contracts';
import { Button, Field, Select } from '@icb/ui';
import { useActionState } from 'react';

import { updateTicketAction } from './ticket-actions';
import { IDLE_STATE } from './types';

const PRIORITIES: readonly SupportTicket['priority'][] = ['low', 'normal', 'high', 'urgent'];
const STATUSES: readonly SupportTicket['status'][] = [
  'open',
  'awaiting_customer',
  'awaiting_agent',
  'resolved',
  'closed',
];

/**
 * Priority and status.
 *
 * Both submit together: the form always posts the full pair, so a change of one can never
 * silently reset the other. Raising priority recomputes the SLA deadline server-side.
 */
export function TicketControls({
  ticketId,
  priority,
  status,
}: Readonly<{
  ticketId: string;
  priority: SupportTicket['priority'];
  status: SupportTicket['status'];
}>) {
  const [state, action, pending] = useActionState(updateTicketAction, IDLE_STATE);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />

      {state.message ? (
        <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
          {state.message}
        </p>
      ) : null}

      <Field label="Priority" description="Raising priority tightens the SLA clock.">
        <Select name="priority" defaultValue={priority}>
          {PRIORITIES.map((value) => (
            <option key={value} value={value} className="capitalize">
              {value}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Status">
        <Select name="status" defaultValue={status}>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" variant="secondary" loading={pending}>
        {pending ? 'Saving…' : 'Update ticket'}
      </Button>
    </form>
  );
}
