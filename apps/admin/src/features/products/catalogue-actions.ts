'use server';

import { feeSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { api } from '@/lib/api';

import { eligibilityFromForm, errorState, fieldErrors, invalidInput } from './form-utils';
import type { FormState, RateChangeView, RateFormState } from './types';

const MIN_RATE_PERCENT = 0;
const MAX_RATE_PERCENT = 100;

const rateSchema = z.object({
  productCode: z.string().min(1),
  effectiveFrom: z.iso.datetime({ local: true }),
  rate: z.number().min(MIN_RATE_PERCENT).max(MAX_RATE_PERCENT),
});

const feesPayloadSchema = z.object({
  productCode: z.string().min(1),
  fees: z.array(feeSchema),
});

const eligibilityPayloadSchema = z.object({
  minimumAge: z.number().int().min(0).max(120).nullable(),
  minimumKycLevel: z.string().nullable(),
  residentsOnly: z.boolean(),
  businessOnly: z.boolean(),
});

/**
 * Announce a rate change.
 *
 * Effective dating is the whole point: the change is written into the product's rate schedule
 * to take effect at a moment — possibly in the future — and accrual resolves "the rate on that
 * day" from the schedule. The API answers with the full schedule, which the form shows back so
 * the operator sees exactly what is now on the books.
 */
export async function scheduleRateAction(
  _previous: RateFormState,
  formData: FormData,
): Promise<RateFormState> {
  const parsed = rateSchema.safeParse({
    productCode: formData.get('productCode'),
    effectiveFrom: formData.get('effectiveFrom'),
    rate: Number(formData.get('rate')),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error), schedule: null };
  }
  const { productCode, effectiveFrom, rate } = parsed.data;

  try {
    const schedule = await api<RateChangeView[]>(`/admin/products/${productCode}/rates`, {
      method: 'POST',
      body: { effectiveFrom: new Date(effectiveFrom).toISOString(), rate },
    });
    revalidatePath(`/products/${productCode}`);
    revalidatePath('/products');
    revalidatePath('/content');
    return { status: 'done', message: null, fieldErrors: {}, schedule };
  } catch (error) {
    return { ...errorState(error, 'The rate change could not be scheduled.'), schedule: null };
  }
}

/** Replace the fee schedule wholesale — the catalogue has no per-fee endpoints. */
export async function saveFeesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formData.get('feesJson');
  let fees: unknown;
  try {
    fees = JSON.parse(typeof raw === 'string' ? raw : '');
  } catch {
    return invalidInput('The fee schedule could not be read.');
  }

  const parsed = feesPayloadSchema.safeParse({ productCode: formData.get('productCode'), fees });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api(`/admin/products/${parsed.data.productCode}`, {
      method: 'PATCH',
      body: { fees: parsed.data.fees },
    });
    revalidatePath(`/products/${parsed.data.productCode}`);
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The fee schedule could not be saved. Please try again.');
  }
}

/** Replace the eligibility rules for a product. */
export async function saveEligibilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const productCode = formData.get('productCode');
  if (typeof productCode !== 'string' || productCode === '') {
    return invalidInput('Invalid product.');
  }

  const parsed = eligibilityPayloadSchema.safeParse(eligibilityFromForm(formData));
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api(`/admin/products/${productCode}`, {
      method: 'PATCH',
      body: { eligibility: parsed.data },
    });
    revalidatePath(`/products/${productCode}`);
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The eligibility rules could not be saved. Please try again.');
  }
}
