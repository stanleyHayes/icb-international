'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

import type { FormState } from './types';

const replySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1, 'A reply cannot be empty').max(4000),
  resolve: z.boolean(),
});

const updateSchema = z.object({
  ticketId: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['open', 'awaiting_customer', 'awaiting_agent', 'resolved', 'closed']),
});

const assignSchema = z.object({
  ticketId: z.string().min(1),
  staffId: z.string().min(1).optional(),
});

const applyMacroSchema = z.object({
  ticketId: z.string().min(1),
  macroId: z.string().min(1),
});

function parseOrFail<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { data: z.infer<S> } | { failure: FormState } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  return {
    failure: {
      status: 'error',
      message: null,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    },
  };
}

function errorState(error: unknown, fallback: string): FormState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

function refresh(ticketId: string): FormState {
  revalidatePath(`/support/${ticketId}`);
  revalidatePath('/support');
  return { status: 'done', message: null, fieldErrors: {} };
}

/** Post a secure-message reply; optionally resolve the ticket in the same action. */
export async function replyAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseOrFail(replySchema, {
    ticketId: formData.get('ticketId'),
    body: formData.get('body'),
    resolve: formData.get('resolve') === 'on',
  });
  if ('failure' in parsed) return parsed.failure;
  const { ticketId, ...body } = parsed.data;

  try {
    await api(`/support/staff/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: { ...body, attachments: [] },
    });
    return refresh(ticketId);
  } catch (error) {
    return errorState(error, 'The reply could not be sent. Please try again.');
  }
}

/** Change priority and/or status. A priority change recomputes the SLA deadline server-side. */
export async function updateTicketAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseOrFail(updateSchema, {
    ticketId: formData.get('ticketId'),
    priority: formData.get('priority'),
    status: formData.get('status'),
  });
  if ('failure' in parsed) return parsed.failure;
  const { ticketId, ...body } = parsed.data;

  try {
    await api(`/support/staff/tickets/${ticketId}`, { method: 'PATCH', body });
    return refresh(ticketId);
  } catch (error) {
    return errorState(error, 'The ticket could not be updated. Please try again.');
  }
}

/** Assign to a chosen agent, or to the caller when no staff id is selected. */
export async function assignAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseOrFail(assignSchema, {
    ticketId: formData.get('ticketId'),
    staffId: formData.get('staffId') || undefined,
  });
  if ('failure' in parsed) return parsed.failure;
  const { ticketId, staffId } = parsed.data;

  try {
    await api(`/support/staff/tickets/${ticketId}/assign`, {
      method: 'POST',
      body: staffId ? { staffId } : {},
    });
    return refresh(ticketId);
  } catch (error) {
    return errorState(error, 'The ticket could not be assigned. Please try again.');
  }
}

/** Least-loaded routing across the active support team. */
export async function autoAssignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseOrFail(assignSchema, { ticketId: formData.get('ticketId') });
  if ('failure' in parsed) return parsed.failure;
  const { ticketId } = parsed.data;

  try {
    await api(`/support/staff/tickets/${ticketId}/auto-assign`, { method: 'POST', body: {} });
    return refresh(ticketId);
  } catch (error) {
    return errorState(error, 'Auto-assign failed. Please try again.');
  }
}

/** Render a macro against the ticket and post it as the agent's reply. */
export async function applyMacroAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseOrFail(applyMacroSchema, {
    ticketId: formData.get('ticketId'),
    macroId: formData.get('macroId'),
  });
  if ('failure' in parsed) return parsed.failure;
  const { ticketId, macroId } = parsed.data;

  try {
    await api(`/support/staff/tickets/${ticketId}/macros/${macroId}/apply`, {
      method: 'POST',
      body: {},
    });
    return refresh(ticketId);
  } catch (error) {
    return errorState(error, 'The macro could not be applied. Please try again.');
  }
}
