'use server';

import { registerRequestSchema } from '@icb/contracts';

import { apiRaw } from '@/lib/api';

import type { AuthFormState } from './password-actions';

/**
 * Open the account.
 *
 * Registration creates the customer and sends the verification email; it deliberately does not
 * sign the customer in — the first session comes from an explicit login. The form therefore ends
 * on "check your inbox", not on a dashboard.
 */
export async function signupAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerRequestSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    acceptedTermsVersion: formData.get('acceptedTermsVersion'),
  });

  if (!parsed.success) {
    return {
      error: null,
      done: false,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }
  if (formData.get('terms') !== 'on') {
    return { error: null, done: false, fieldErrors: { terms: 'You must accept the terms to open an account' } };
  }
  if (formData.get('password') !== formData.get('confirmPassword')) {
    return { error: null, done: false, fieldErrors: { confirmPassword: 'The passwords do not match' } };
  }

  const { response, data } = await apiRaw('/auth/register', parsed.data);
  if (!response.ok) {
    const problem = data as { detail?: string } | null;
    return {
      error: problem?.detail ?? 'We could not open your account. Please try again.',
      done: false,
      fieldErrors: {},
    };
  }

  return { error: null, fieldErrors: {}, done: true };
}
