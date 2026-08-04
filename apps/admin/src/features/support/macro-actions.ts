'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

import type { FormState } from './types';

const macroSchema = z.object({
  macroId: z.string().min(1).optional(),
  name: z.string().min(2, 'Give the macro a name').max(80),
  category: z.string().min(1).max(40).default('general'),
  body: z.string().min(1, 'The macro needs a body').max(4000),
});

const deleteSchema = z.object({ macroId: z.string().min(1) });

function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
  );
}

function errorState(error: unknown, fallback: string): FormState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

/** Create a macro, or update it when the form carries a macro id. */
export async function saveMacroAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = macroSchema.safeParse({
    macroId: formData.get('macroId') || undefined,
    name: formData.get('name'),
    category: formData.get('category') || 'general',
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }
  const { macroId, ...body } = parsed.data;

  try {
    if (macroId) {
      await api(`/support/staff/macros/${macroId}`, { method: 'PATCH', body });
    } else {
      await api('/support/staff/macros', { method: 'POST', body });
    }
    revalidatePath('/support/macros');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The macro could not be saved. Please try again.');
  }
}

/** Delete a macro. Confirmed in the UI before this action runs. */
export async function deleteMacroAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = deleteSchema.safeParse({ macroId: formData.get('macroId') });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api(`/support/staff/macros/${parsed.data.macroId}`, { method: 'DELETE' });
    revalidatePath('/support/macros');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The macro could not be deleted. Please try again.');
  }
}
