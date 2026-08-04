'use server';

import { loginRequestSchema, type LoginResponse } from '@icb/contracts';
import { redirect } from 'next/navigation';

import { apiRaw } from '@/lib/api';
import { clearSession } from '@/lib/session';

import { establishSession } from './session';

export interface LoginState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Sign in.
 *
 * Runs entirely on the server: the API's response — including the access token — is sealed into
 * the session cookie and never returned to the browser. The action's return value carries only
 * what the form needs to render an error.
 */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  const { response, data } = await apiRaw('/auth/login', parsed.data);

  if (!response.ok) {
    const problem = data as { detail?: string } | null;
    return {
      error: problem?.detail ?? 'We could not sign you in. Please try again.',
      fieldErrors: {},
    };
  }

  const payload = data as LoginResponse;

  // A second factor stands between password and session: hand the challenge to the MFA screen.
  // The challenge id is opaque and short-lived, so travelling in the URL leaks nothing useful.
  if (payload.outcome === 'mfa_required') {
    const query = new URLSearchParams({
      challengeId: payload.challenge.challengeId,
      method: payload.challenge.method,
      ...(payload.challenge.hint ? { hint: payload.challenge.hint } : {}),
    });
    redirect(`/login/mfa?${query.toString()}`);
  }

  await establishSession(response.headers.get('set-cookie'), payload.tokens, payload.user);

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}
