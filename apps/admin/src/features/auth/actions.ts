'use server';

import { loginRequestSchema, type AuthenticatedUser, type AuthTokens } from '@icb/contracts';
import { redirect } from 'next/navigation';

import { apiRaw } from '@/lib/api';
import { clearSession, writeSession } from '@/lib/session';

export interface LoginState {
  error: string | null;
  fieldErrors: Record<string, string>;
}

interface LoginPayload {
  tokens: AuthTokens;
  user: AuthenticatedUser;
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

  const payload = data as LoginPayload;
  const refreshCookie = response.headers.get('set-cookie') ?? '';

  await writeSession({
    accessToken: payload.tokens.accessToken,
    refreshCookie,
    expiresAt: Date.now() + payload.tokens.expiresIn * 1000,
    user: {
      userId: payload.user.userId,
      customerId: payload.user.customerId,
      email: payload.user.email,
      firstName: payload.user.firstName,
      lastName: payload.user.lastName,
    },
  });

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}
