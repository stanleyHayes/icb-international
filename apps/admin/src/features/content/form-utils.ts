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

export const DONE_STATE: FormState = { status: 'done', message: null, fieldErrors: {} };

/** Optional number; empty string means null. */
export function numberFromForm(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** A list of values from a one-per-line textarea; blank lines are dropped. */
export function linesFromForm(formData: FormData, name: string): string[] {
  const raw = formData.get(name);
  if (typeof raw !== 'string') return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
