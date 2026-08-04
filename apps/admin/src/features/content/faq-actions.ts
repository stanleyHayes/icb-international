'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { api } from '@/lib/api';

import {
  DONE_STATE,
  errorState,
  fieldErrors,
  invalidInput,
  numberFromForm,
} from './form-utils';
import type { FormState } from './types';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const faqSchema = z.object({
  title: z.string().min(2, 'Give the article a title').max(120),
  slug: z
    .string()
    .regex(SLUG_PATTERN, 'Lowercase words separated by hyphens')
    .max(140)
    .optional(),
  category: z.string().min(1, 'Pick a category').max(60),
  body: z.string().min(1, 'The article needs a body').max(20000),
  published: z.boolean(),
  ordering: z.number().int().min(0).max(9999),
});

const idSchema = z.object({ articleId: z.string().min(1) });

const publishSchema = z.object({
  articleId: z.string().min(1),
  published: z.enum(['true', 'false']),
});

function faqFromForm(formData: FormData) {
  const slug = formData.get('slug');
  return {
    title: formData.get('title'),
    slug: typeof slug === 'string' && slug.trim() !== '' ? slug.trim() : undefined,
    category: formData.get('category'),
    body: formData.get('body'),
    published: formData.get('published') === 'on',
    ordering: numberFromForm(formData, 'ordering') ?? 0,
  };
}

/** Publish a new FAQ article. */
export async function createFaqArticleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = faqSchema.safeParse(faqFromForm(formData));
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api('/admin/content/faq', {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The article could not be created. Please try again.');
  }
}

/** Edit an existing FAQ article; the form always posts the full field set. */
export async function updateFaqArticleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse({ articleId: formData.get('articleId') });
  if (!id.success) return invalidInput('Invalid article.');

  const parsed = faqSchema.safeParse(faqFromForm(formData));
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api(`/admin/content/faq/${id.data.articleId}`, { method: 'PATCH', body: parsed.data });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The article could not be updated. Please try again.');
  }
}

/** Publish or unpublish an article without opening the editor. */
export async function setFaqPublishedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = publishSchema.safeParse({
    articleId: formData.get('articleId'),
    published: formData.get('published'),
  });
  if (!parsed.success) return invalidInput('Invalid article.');

  try {
    await api(`/admin/content/faq/${parsed.data.articleId}`, {
      method: 'PATCH',
      body: { published: parsed.data.published === 'true' },
    });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The article visibility could not be changed. Please try again.');
  }
}

/** Delete an article. Confirmed in the UI before this action runs. */
export async function deleteFaqArticleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ articleId: formData.get('articleId') });
  if (!parsed.success) return invalidInput('Invalid article.');

  try {
    await api(`/admin/content/faq/${parsed.data.articleId}`, { method: 'DELETE' });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The article could not be deleted. Please try again.');
  }
}
