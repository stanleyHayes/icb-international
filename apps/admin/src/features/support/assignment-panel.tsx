'use client';

import { Button, Field, Select } from '@icb/ui';
import { useActionState, useState } from 'react';

import { assignAction, autoAssignAction } from './ticket-actions';
import { IDLE_STATE, type AssigneeOption } from './types';

/**
 * Assignment.
 *
 * Three deliberate routes: take the ticket yourself, hand it to a named agent, or let the
 * router pick the least-loaded support agent. Self-assignment is one click because it is what
 * an operator does dozens of times a day.
 */
export function AssignmentPanel({
  ticketId,
  assignees,
}: Readonly<{ ticketId: string; assignees: AssigneeOption[] }>) {
  const [assignState, assign, assigning] = useActionState(assignAction, IDLE_STATE);
  const [autoState, autoAssign, autoAssigning] = useActionState(autoAssignAction, IDLE_STATE);
  const [staffId, setStaffId] = useState('');

  const message = assignState.message ?? autoState.message;

  return (
    <div className="space-y-3">
      {message ? (
        <p role="alert" className="text-sm text-[var(--icb-danger-fg)]">
          {message}
        </p>
      ) : null}

      <form action={assign} className="flex items-end gap-2">
        <input type="hidden" name="ticketId" value={ticketId} />
        <Field label="Agent" className="flex-1">
          <Select
            name="staffId"
            value={staffId}
            onChange={(event) => setStaffId(event.target.value)}
          >
            <option value="">Myself</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" loading={assigning}>
          Assign
        </Button>
      </form>

      <form action={autoAssign}>
        <input type="hidden" name="ticketId" value={ticketId} />
        <Button type="submit" variant="ghost" size="sm" loading={autoAssigning}>
          Auto-assign to least-loaded agent
        </Button>
      </form>
    </div>
  );
}
