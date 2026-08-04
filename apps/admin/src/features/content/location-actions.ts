'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { api } from '@/lib/api';

import {
  DONE_STATE,
  errorState,
  fieldErrors,
  invalidInput,
  linesFromForm,
  numberFromForm,
} from './form-utils';
import type { FormState } from './types';

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

const addressSchema = z.object({
  line1: z.string().min(1, 'Street address is required').max(120),
  line2: z.string().max(120).optional(),
  city: z.string().min(1, 'City is required').max(80),
  region: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().regex(COUNTRY_PATTERN, 'Two-letter country code, e.g. GH'),
});

const locationSchema = z.object({
  name: z.string().min(2, 'Give the location a name').max(120),
  type: z.enum(['branch', 'atm']),
  address: addressSchema,
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  hours: z.string().max(500),
  services: z.array(z.string().min(1).max(80)).max(20),
  active: z.boolean(),
});

const idSchema = z.object({ locationId: z.string().min(1) });

function locationFromForm(formData: FormData) {
  return {
    name: formData.get('name'),
    type: formData.get('type'),
    address: {
      line1: formData.get('line1'),
      line2: formData.get('line2') || undefined,
      city: formData.get('city'),
      region: formData.get('region') || undefined,
      postalCode: formData.get('postalCode') || undefined,
      country: formData.get('country'),
    },
    latitude: numberFromForm(formData, 'latitude'),
    longitude: numberFromForm(formData, 'longitude'),
    hours: formData.get('hours'),
    services: linesFromForm(formData, 'services'),
    active: formData.get('active') === 'on',
  };
}

function toBody(data: z.infer<typeof locationSchema>) {
  return {
    ...data,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
  };
}

/** Add a branch or ATM to the locator. */
export async function createLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = locationSchema.safeParse(locationFromForm(formData));
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api('/admin/content/locations', {
      method: 'POST',
      body: toBody(parsed.data),
      idempotencyKey: crypto.randomUUID(),
    });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The location could not be created. Please try again.');
  }
}

/** Edit a location; the form always posts the full field set. */
export async function updateLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse({ locationId: formData.get('locationId') });
  if (!id.success) return invalidInput('Invalid location.');

  const parsed = locationSchema.safeParse(locationFromForm(formData));
  if (!parsed.success) {
    return { status: 'error', message: null, fieldErrors: fieldErrors(parsed.error) };
  }

  try {
    await api(`/admin/content/locations/${id.data.locationId}`, {
      method: 'PATCH',
      body: toBody(parsed.data),
    });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The location could not be updated. Please try again.');
  }
}

/** Remove a location from the locator. Confirmed in the UI before this action runs. */
export async function deleteLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ locationId: formData.get('locationId') });
  if (!parsed.success) return invalidInput('Invalid location.');

  try {
    await api(`/admin/content/locations/${parsed.data.locationId}`, { method: 'DELETE' });
    revalidatePath('/content');
    return DONE_STATE;
  } catch (error) {
    return errorState(error, 'The location could not be deleted. Please try again.');
  }
}
