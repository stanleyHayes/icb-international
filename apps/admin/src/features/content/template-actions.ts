'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ApiError, api } from '@/lib/api';

import { DONE_STATE, errorState, fieldErrors, invalidInput } from './form-utils';
import type { FormState, TemplatePreviewResult } from './types';

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const templateSchema = z.object({
  key: z
    .string()
    .regex(KEY_PATTERN, 'Lowercase snake_case, starting with a letter')
    .max(80),
  channel: z.enum(['in_app', 'email', 'sms', 'push']),
  subject: z.string().max(200),
  body: z.string().min(1, 'The template needs a body').max(8000),
});

const idSchema = z.object({ templateId: z.string().min(1) });

export interface TemplateDraft {
  key: string;
  channel: string;
  subject: string;
  body: string;
}

export type PreviewOutcome =
  | { ok: true; preview: TemplatePreviewResult }
  | { ok: false; message: string; fieldErrors: Record<string, string> };

/** Create or replace the override for a template key + channel. */
export async function upsertTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = templateSchema.safeParse({
    key: formData.get('key'),
    channel: formData.get('channel'),
    subject: formData.get('subject'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api('/admin/content/templates', {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The template override could not be saved. Please try again.');
  }
}

/** Render a draft override against sample data, without saving it. */
export async function previewTemplateAction(draft: TemplateDraft): Promise<PreviewOutcome> {
  const parsed = templateSchema.safeParse(draft);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Fix the highlighted fields before previewing.',
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  try {
    const preview = await api<TemplatePreviewResult>('/admin/content/templates/preview', {
      method: 'POST',
      body: parsed.data,
    });
    return { ok: true, preview };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof ApiError
          ? error.problem.detail
          : 'The preview could not be rendered. Please try again.',
      fieldErrors: {},
    };
  }
}

/** Remove an override, returning the template to its shipped default. */
export async function deleteTemplateAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ templateId: formData.get('templateId') });
  if (!parsed.success) return invalidInput('Invalid template override.');

  try {
    await api(`/admin/content/templates/${parsed.data.templateId}`, { method: 'DELETE' });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The template override could not be removed. Please try again.');
  }
}
