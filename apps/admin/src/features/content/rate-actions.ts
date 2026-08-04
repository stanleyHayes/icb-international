'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { api } from '@/lib/api';

import { DONE_STATE, errorState, fieldErrors, invalidInput, numberFromForm } from './form-utils';
import type { FormState } from './types';

const PRODUCT_CODE_PATTERN = /^[a-z0-9-]+$/;

const rateSchema = z.object({
  productCode: z
    .string()
    .regex(PRODUCT_CODE_PATTERN, 'Lowercase letters, digits and hyphens')
    .max(40),
  name: z.string().min(2, 'Give the entry a name').max(80),
  rate: z.number().min(0).max(100),
  effectiveFrom: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time')
    .transform((value) => new Date(value).toISOString()),
});

const idSchema = z.object({ entryId: z.string().min(1) });

/**
 * Publish a rate override for a product. Upserts by product code, so re-saving the same code
 * replaces the previous override rather than duplicating it.
 */
export async function upsertRateEntryAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = rateSchema.safeParse({
    productCode: formData.get('productCode'),
    name: formData.get('name'),
    rate: numberFromForm(formData, 'rate'),
    effectiveFrom: formData.get('effectiveFrom'),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api('/admin/content/rates', {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The rate entry could not be saved. Please try again.');
  }
}

/** Remove a rate override; the catalogue rate shows through again. */
export async function deleteRateEntryAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ entryId: formData.get('entryId') });
  if (!parsed.success) return invalidInput('Invalid rate entry.');

  try {
    await api(`/admin/content/rates/${parsed.data.entryId}`, { method: 'DELETE' });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The rate entry could not be removed. Please try again.');
  }
}
