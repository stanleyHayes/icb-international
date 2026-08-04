import { getScale, isCurrencyCode, type CurrencyCode } from '@icb/money';
import type { MoneyDto } from '@icb/contracts';
import type { z } from 'zod';

import { ApiError } from '@/lib/api';

import type { FormState } from './types';

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
  );
}

export function errorState(error: unknown, fallback: string): FormState {
  return {
    status: 'error',
    message: error instanceof ApiError ? error.problem.detail : fallback,
    fieldErrors: {},
  };
}

export function invalidInput(message: string): FormState {
  return { status: 'error', message, fieldErrors: {} };
}

/** The checked currencies, in the order the form posted them; the first is the money currency. */
export function currenciesFromForm(formData: FormData): CurrencyCode[] {
  return formData
    .getAll('currencies')
    .filter((value): value is string => typeof value === 'string')
    .filter(isCurrencyCode);
}

/** Optional money from a hidden minor-units input; empty means "not set" (null). */
export function moneyFromForm(
  formData: FormData,
  name: string,
  currency: CurrencyCode,
): MoneyDto | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw === '') return null;
  const minorUnits = Number(raw);
  if (!Number.isInteger(minorUnits)) return null;
  return { minorUnits, currency, scale: getScale(currency) };
}

/** Optional number; empty string means null. */
export function numberFromForm(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Feature list from a one-per-line textarea. */
export function featuresFromForm(formData: FormData): string[] {
  const raw = formData.get('features');
  if (typeof raw !== 'string') return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Eligibility rules from their four form controls; empty age/level mean "no restriction". */
export function eligibilityFromForm(formData: FormData) {
  const level = formData.get('minimumKycLevel');
  return {
    minimumAge: numberFromForm(formData, 'minimumAge'),
    minimumKycLevel: typeof level === 'string' && level !== '' ? level : null,
    residentsOnly: formData.get('residentsOnly') === 'on',
    businessOnly: formData.get('businessOnly') === 'on',
  };
}
