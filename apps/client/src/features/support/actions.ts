'use server';

import type { AssetRef, SupportMessage, SupportTicket } from '@icb/contracts';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

import { ApiError, api } from '@/lib/api';

import type { CallbackView } from './types';
import { MAX_ATTACHMENTS } from './types';
import { uploadAttachment } from './upload-attachment';

export interface SupportActionState {
  error: string | null;
  done: boolean;
}

const DONE: SupportActionState = { error: null, done: true };

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/** Opens a secure-message ticket, then sends the customer straight into the thread. */
export async function createTicketAction(
  _previous: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const subject = formData.get('subject');
  const category = formData.get('category');
  const body = formData.get('body');

  if (
    typeof subject !== 'string' ||
    typeof category !== 'string' ||
    typeof body !== 'string' ||
    subject.trim().length < 4 ||
    body.trim().length < 10
  ) {
    return { error: 'Give the message a subject and at least a sentence of detail.', done: false };
  }

  let ticket: SupportTicket;
  try {
    ticket = await api<SupportTicket>('/support/tickets', {
      method: 'POST',
      body: { subject: subject.trim(), category, body: body.trim(), attachments: [] },
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (error) {
    return { error: message(error, 'We could not send your message. Please try again.'), done: false };
  }

  revalidateTag('support', 'max');
  redirect(`/support/tickets/${ticket.id}`);
}

/** Replies inside an existing thread, uploading any attachments first. */
export async function replyAction(
  _previous: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const ticketId = formData.get('ticketId');
  const body = formData.get('body');
  if (typeof ticketId !== 'string' || typeof body !== 'string' || body.trim() === '') {
    return { error: 'Write your reply first.', done: false };
  }

  const files = formData
    .getAll('attachments')
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, MAX_ATTACHMENTS);

  try {
    const attachments: AssetRef[] = [];
    for (const file of files) {
      attachments.push(await uploadAttachment(file));
    }
    await api<SupportMessage>(`/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: { body: body.trim(), attachments },
    });
  } catch (error) {
    return { error: message(error, 'We could not send your reply. Please try again.'), done: false };
  }

  revalidatePath(`/support/tickets/${ticketId}`);
  return DONE;
}

/** Requests a callback in a chosen window. */
export async function requestCallbackAction(
  _previous: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const phone = formData.get('phone');
  const preferredWindow = formData.get('preferredWindow');
  const reason = formData.get('reason');

  if (typeof phone !== 'string' || typeof reason !== 'string' || reason.trim().length < 4) {
    return { error: 'We need a number and a reason for the call.', done: false };
  }

  try {
    await api<CallbackView>('/support/callbacks', {
      method: 'POST',
      body: {
        phone: phone.trim(),
        reason: reason.trim(),
        preferredWindow: typeof preferredWindow === 'string' ? preferredWindow : 'any',
      },
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (error) {
    return { error: message(error, 'We could not book that callback. Please try again.'), done: false };
  }

  revalidateTag('support', 'max');
  return DONE;
}
