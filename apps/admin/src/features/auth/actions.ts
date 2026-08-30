'use server';

import { loginRequestSchema, type LoginResponse } from '@icb/contracts';
import { redirect } from 'next/navigation';

import { apiRaw } from '@/lib/api';
import { clearSession, writeSession, type SessionData } from '@/lib/session';

export interface LoginState {
  error: string | null;
  fieldErrors: Record<string, string>;
  // Echoed back so the form can re-seed the email input: React resets uncontrolled fields
  // after a form action resolves, and without this the user retypes their email every failure.
  email: string;
}

// Not exported: a 'use server' module may only export async functions — exporting this value
// left it undefined in the client bundle and crashed /login. The form keeps its own copy.
const INITIAL_LOGIN_STATE: LoginState = {
  error: null,
  fieldErrors: {},
  email: '',
};

function toSession(payload: LoginResponse, refreshCookie: string): SessionData {
  return {
    accessToken: payload.tokens.accessToken,
    refreshCookie,
    expiresAt: Date.now() + payload.tokens.expiresIn * 1000,
    user: {
      userId: payload.user.userId,
      customerId: payload.user.customerId,
      email: payload.user.email,
      firstName: payload.user.firstName,
      lastName: payload.user.lastName,
      roles: payload.user.roles,
    },
  };
}

function problemDetail(data: unknown, fallback: string): string {
  const problem = data as { detail?: string } | null;
  return problem?.detail ?? fallback;
}

/**
 * Sign in.
 *
 * Runs entirely on the server: the API's response — including the access token — is sealed into
 * the session cookie and never returned to the browser.
 */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get('email');
  const email = typeof rawEmail === 'string' ? rawEmail : '';
  const parsed = loginRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      ...INITIAL_LOGIN_STATE,
      email,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  const { response, data } = await apiRaw('/auth/login', parsed.data);

  if (!response.ok) {
    return {
      ...INITIAL_LOGIN_STATE,
      email,
      error: problemDetail(data, 'We could not sign you in. Please try again.'),
    };
  }

  const payload = data as LoginResponse;
  await writeSession(toSession(payload, response.headers.get('set-cookie') ?? ''));
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}
