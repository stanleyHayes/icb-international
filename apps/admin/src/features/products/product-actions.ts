'use server';

import { productSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { api } from '@/lib/api';

import {
  currenciesFromForm,
  eligibilityFromForm,
  errorState,
  featuresFromForm,
  fieldErrors,
  invalidInput,
  moneyFromForm,
  numberFromForm,
} from './form-utils';
import type { FormState } from './types';

const coreSchema = z.object({
  productCode: z.string().min(1),
  name: z.string().min(2).max(80),
  tagline: z.string().min(2).max(160),
  description: z.string().min(10).max(2000),
  displayOrder: z.number().int().nonnegative(),
});

const activeSchema = z.object({
  productCode: z.string().min(1),
  active: z.enum(['true', 'false']),
});

/** Create a product. Validated against the full shared product schema before it is posted. */
export async function createProductAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const currencies = currenciesFromForm(formData);
  const primary = currencies[0];
  if (!primary) return invalidInput('Select at least one currency.');

  const candidate = {
    code: formData.get('code'),
    name: formData.get('name'),
    tagline: formData.get('tagline'),
    description: formData.get('description'),
    kind: formData.get('kind'),
    currencies,
    interestRate: numberFromForm(formData, 'interestRate'),
    interestBands: null,
    minimumOpeningBalance: moneyFromForm(formData, 'minimumOpeningBalance', primary),
    minimumBalance: moneyFromForm(formData, 'minimumBalance', primary),
    monthlyFee: moneyFromForm(formData, 'monthlyFee', primary),
    fees: [],
    features: featuresFromForm(formData),
    eligibility: eligibilityFromForm(formData),
    active: true,
    displayOrder: numberFromForm(formData, 'displayOrder') ?? 100,
  };

  const parsed = productSchema.safeParse(candidate);
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api('/admin/products', { method: 'POST', body: parsed.data });
    revalidatePath('/products');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The product could not be created. Please try again.');
  }
}

/** Edit the customer-facing copy and ordering of a product. */
export async function updateCoreAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = coreSchema.safeParse({
    productCode: formData.get('productCode'),
    name: formData.get('name'),
    tagline: formData.get('tagline'),
    description: formData.get('description'),
    displayOrder: numberFromForm(formData, 'displayOrder'),
  });
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }
  const { productCode, ...body } = parsed.data;

  try {
    await api(`/admin/products/${productCode}`, {
      method: 'PATCH',
      body: { ...body, features: featuresFromForm(formData) },
    });
    revalidatePath(`/products/${productCode}`);
    revalidatePath('/products');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The product could not be updated. Please try again.');
  }
}

/** Retire or reactivate a product. Confirmed in the UI before this action runs. */
export async function setActiveAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = activeSchema.safeParse({
    productCode: formData.get('productCode'),
    active: formData.get('active'),
  });
  if (!parsed.success) return invalidInput('Invalid product.');

  try {
    await api(`/admin/products/${parsed.data.productCode}`, {
      method: 'PATCH',
      body: { active: parsed.data.active === 'true' },
    });
    revalidatePath(`/products/${parsed.data.productCode}`);
    revalidatePath('/products');
    return { status: 'done', message: null, fieldErrors: {} };
  } catch (error) {
    return errorState(error, 'The product status could not be changed. Please try again.');
  }
}
