'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

import type { FormState } from './types';

const completeSchema = z.object({
  callbackId: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

const cancelSchema = z.object({ callbackId: z.string().min(1) });

function errorState(error: unknown, fallback: string): FormState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

/** Mark a callback completed, with the outcome notes the customer record keeps. */
export async function completeCallbackAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = completeSchema.safeParse({
    callbackId: formData.get('callbackId'),
    notes: formData.get('notes') || undefined,
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: null,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  try {
    await api(`/support/staff/callbacks/${parsed.data.callbackId}/complete`, {
      method: 'POST',
      body: { notes: parsed.data.notes ?? null },
    });
    revalidatePath('/support/callbacks');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The callback could not be completed. Please try again.');
  }
}

/** Cancel a pending callback. Confirmed in the UI before this action runs. */
export async function cancelCallbackAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = cancelSchema.safeParse({ callbackId: formData.get('callbackId') });
  if (!parsed.success) {
    return { status: 'error', message: 'Invalid callback.', fieldErrors: {} };
  }

  try {
    await api(`/support/staff/callbacks/${parsed.data.callbackId}/cancel`, {
      method: 'POST',
      body: {},
    });
    revalidatePath('/support/callbacks');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The callback could not be cancelled. Please try again.');
  }
}
