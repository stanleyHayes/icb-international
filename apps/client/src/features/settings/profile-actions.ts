'use server';

import type { CustomerProfile } from '@icb/contracts';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface SettingsActionState {
  error: string | null;
  done: boolean;
}

const DONE: SettingsActionState = { error: null, done: true };

function message(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

function text(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

const INCOME_BANDS = new Set(['under_25k', '25k_50k', '50k_100k', '100k_250k', 'over_250k']);
const E164 = /^\+[1-9]\d{7,14}$/;

/** Sets a key only when the trimmed value is non-empty — optional fields are never sent as ''. */
function present(formData: FormData, key: string): Record<string, string> {
  const value = text(formData, key);
  return value === undefined ? {} : { [key]: value };
}

function buildIndividualPatch(formData: FormData): Record<string, string> {
  const incomeBand = text(formData, 'annualIncomeBand');
  return {
    firstName: text(formData, 'firstName') ?? '',
    lastName: text(formData, 'lastName') ?? '',
    ...present(formData, 'middleName'),
    ...present(formData, 'occupation'),
    ...present(formData, 'employer'),
    ...(incomeBand !== undefined && INCOME_BANDS.has(incomeBand)
      ? { annualIncomeBand: incomeBand }
      : {}),
  };
}

/** Personal details and employment. Empty optional fields are stripped, never sent as ''. */
export async function savePersonalDetailsAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const phone = text(formData, 'phone');
  if (text(formData, 'firstName') === undefined || text(formData, 'lastName') === undefined) {
    return { error: 'First and last name are required.', done: false };
  }
  if (phone !== undefined && !E164.test(phone)) {
    return { error: 'Enter the phone number in international format, e.g. +233201234567.', done: false };
  }

  try {
    await api<CustomerProfile>('/customers/me', {
      method: 'PATCH',
      body: { individual: buildIndividualPatch(formData), ...present(formData, 'phone') },
    });
    revalidateTag('profile', 'max');
    return DONE;
  } catch (error) {
    return { error: message(error, 'We could not save your details. Please try again.'), done: false };
  }
}

function readAddress(formData: FormData) {
  const line1 = text(formData, 'line1');
  const city = text(formData, 'city');
  const country = text(formData, 'country');
  if (!line1 || !city || !country) return null;
  return {
    line1,
    city,
    country: country.toUpperCase(),
    ...(text(formData, 'line2') ? { line2: text(formData, 'line2') } : {}),
    ...(text(formData, 'region') ? { region: text(formData, 'region') } : {}),
    ...(text(formData, 'postalCode') ? { postalCode: text(formData, 'postalCode') } : {}),
  };
}

/** One address block at a time ('residential' or 'postal'). Clearing the postal address removes it. */
export async function saveAddressAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const kind = formData.get('kind');
  if (kind !== 'residential' && kind !== 'postal') {
    return { error: 'Unknown address.', done: false };
  }

  const address = readAddress(formData);
  if (address === null) {
    if (kind === 'postal') {
      return persist({ postalAddress: null });
    }
    return { error: 'An address needs at least a street, a city and a country.', done: false };
  }
  if (!/^[A-Z]{2}$/.test(address.country)) {
    return { error: 'Country must be a two-letter ISO code, e.g. GH or GB.', done: false };
  }
  return persist(kind === 'residential' ? { residentialAddress: address } : { postalAddress: address });
}

async function persist(body: Record<string, unknown>): Promise<SettingsActionState> {
  try {
    await api<CustomerProfile>('/customers/me', { method: 'PATCH', body });
    revalidateTag('profile', 'max');
    return DONE;
  } catch (error) {
    return { error: message(error, 'We could not save the address. Please try again.'), done: false };
  }
}

/** Marketing opt-ins — the same preferences endpoint, a different slice of it. */
export async function saveMarketingAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  return persistPrefs({
    marketingEmail: formData.get('marketingEmail') === 'on',
    marketingSms: formData.get('marketingSms') === 'on',
  });
}

/** Locale, timezone and statement delivery. */
export async function saveContactPrefsAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const locale = text(formData, 'locale');
  const timezone = text(formData, 'timezone');
  const statementDelivery = text(formData, 'statementDelivery');
  if (!locale || !timezone || !statementDelivery) {
    return { error: 'All three are required.', done: false };
  }
  return persistPrefs({ locale, timezone, statementDelivery });
}

async function persistPrefs(body: Record<string, unknown>): Promise<SettingsActionState> {
  try {
    await api<CustomerProfile>('/customers/me/preferences', { method: 'PATCH', body });
    revalidateTag('profile', 'max');
    return DONE;
  } catch (error) {
    return { error: message(error, 'We could not save your preferences. Please try again.'), done: false };
  }
}
