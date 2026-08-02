'use server';

import { registerRequestSchema } from '@icb/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/v1';
const CLIENT_URL = process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3101';

export interface ApplicationState {
  status: 'idle' | 'error' | 'submitted';
  message: string | null;
  fieldErrors: Record<string, string>;
  signInUrl: string | null;
}

/**
 * The account application.
 *
 * This creates a real customer and a real KYC case through the API — it is not a marketing form
 * that emails someone. The applicant lands on the dashboard able to sign in, which is the whole
 * point of an onboarding funnel.
 */
export async function applyAction(
  _previous: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const parsed = registerRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    phone: formData.get('phone'),
    acceptedTermsVersion: '2026-01',
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: null,
      signInUrl: null,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(parsed.data),
    cache: 'no-store',
  });

  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null;
    return {
      status: 'error',
      message: problem?.detail ?? 'We could not open your account. Please try again.',
      fieldErrors: {},
      signInUrl: null,
    };
  }

  return {
    status: 'submitted',
    message: null,
    fieldErrors: {},
    signInUrl: `${CLIENT_URL}/login`,
  };
}
