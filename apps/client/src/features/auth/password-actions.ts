'use server';

import {
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@icb/contracts';

import { apiRaw } from '@/lib/api';

export interface AuthFormState {
  error: string | null;
  fieldErrors: Record<string, string>;
  done: boolean;
}

const IDLE: AuthFormState = { error: null, fieldErrors: {}, done: false };

function fieldErrorsOf(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  return Object.fromEntries(issues.map((issue) => [issue.path.map(String).join('.'), issue.message]));
}

async function postAnonymous(path: string, body: unknown): Promise<string | null> {
  const { response, data } = await apiRaw(path, body);
  if (response.ok) {
    return null;
  }
  const problem = data as { detail?: string } | null;
  return problem?.detail ?? 'Something went wrong. Please try again.';
}

/**
 * Ask for a reset code.
 *
 * The API answers 204 whether or not the address exists — account enumeration is not a feature
 * — and this action preserves that: every outcome but a transport failure looks identical.
 */
export async function forgotPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ...IDLE, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const error = await postAnonymous('/auth/forgot-password', parsed.data);
  return { error, fieldErrors: {}, done: error === null };
}

/** Choose a new password with the code from the reset email. Every other session is ended. */
export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordRequestSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ...IDLE, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  if (formData.get('password') !== formData.get('confirmPassword')) {
    return { ...IDLE, fieldErrors: { confirmPassword: 'The passwords do not match' } };
  }

  const error = await postAnonymous('/auth/reset-password', parsed.data);
  return { error, fieldErrors: {}, done: error === null };
}

/** Confirm an email address with the code from the welcome email. */
export async function verifyEmailAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = verifyEmailRequestSchema.safeParse({ token: formData.get('token') });
  if (!parsed.success) {
    return { ...IDLE, fieldErrors: { token: 'Enter the full verification code from the email' } };
  }

  const error = await postAnonymous('/auth/verify-email', parsed.data);
  return { error, fieldErrors: {}, done: error === null };
}
