'use server';

import {
  loginRequestSchema,
  mfaVerifyRequestSchema,
  type AuthenticatedUser,
  type AuthTokens,
  type LoginResponse,
  type MfaChallenge,
} from '@icb/contracts';
import { redirect } from 'next/navigation';

import { apiRaw } from '@/lib/api';
import { clearSession, writeSession, type SessionData } from '@/lib/session';
import type { Route } from 'next';

export interface LoginState {
  /** Which step the form renders: credentials, or the second-factor code. */
  step: 'credentials' | 'mfa';
  error: string | null;
  fieldErrors: Record<string, string>;
  /** Present when the API asked for a second factor; echoed into the verify form. */
  challenge: MfaChallenge | null;
}

// Not exported: a 'use server' module may only export async functions — exporting this value
// left it undefined in the client bundle and crashed /login. The form keeps its own copy.
const INITIAL_LOGIN_STATE: LoginState = {
  step: 'credentials',
  error: null,
  fieldErrors: {},
  challenge: null,
};

interface TokenPayload {
  tokens: AuthTokens;
  user: AuthenticatedUser;
}

function toSession(payload: TokenPayload, refreshCookie: string): SessionData {
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
      mfaEnabled: payload.user.mfaEnabled,
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
 * the session cookie and never returned to the browser. When the account has a second factor the
 * API answers with a challenge instead of tokens, and the form moves to the code step; the
 * challenge id is an opaque reference, safe to round-trip through the client.
 */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginRequestSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      ...INITIAL_LOGIN_STATE,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  const { response, data } = await apiRaw('/auth/login', parsed.data);

  if (!response.ok) {
    return {
      ...INITIAL_LOGIN_STATE,
      error: problemDetail(data, 'We could not sign you in. Please try again.'),
    };
  }

  const payload = data as LoginResponse;

  if (payload.outcome === 'mfa_required') {
    return { step: 'mfa', error: null, fieldErrors: {}, challenge: payload.challenge };
  }

  await writeSession(toSession(payload, response.headers.get('set-cookie') ?? ''));
  redirect(afterLoginPath(payload.user));
}

/** Complete the second factor started by `loginAction`. */
export async function verifyMfaAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = mfaVerifyRequestSchema.safeParse({
    challengeId: formData.get('challengeId'),
    code: formData.get('code'),
  });

  if (!parsed.success) {
    return {
      ...INITIAL_LOGIN_STATE,
      step: 'mfa',
      challenge: challengeFromForm(formData),
      error: 'Enter the 6-digit code from your authenticator.',
    };
  }

  const { response, data } = await apiRaw('/auth/mfa/verify', parsed.data);

  if (!response.ok) {
    return {
      ...INITIAL_LOGIN_STATE,
      step: 'mfa',
      challenge: challengeFromForm(formData),
      error: problemDetail(data, 'That code was not accepted. Please try again.'),
    };
  }

  const payload = data as TokenPayload;
  await writeSession(toSession(payload, response.headers.get('set-cookie') ?? ''));
  redirect(afterLoginPath(payload.user));
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/login');
}

/** Staff who have not enrolled a second factor land on the enrolment gate, never the console. */
function afterLoginPath(user: AuthenticatedUser): Route {
  const isStaff = user.roles.length > 0;
  return isStaff && !user.mfaEnabled ? '/mfa-enrol' : '/';
}

/** Rebuild the challenge the form posted back, so a failed verify keeps the code step alive. */
function challengeFromForm(formData: FormData): MfaChallenge | null {
  const challengeId = formData.get('challengeId');
  const expiresAt = formData.get('expiresAt');
  if (typeof challengeId !== 'string' || typeof expiresAt !== 'string') {
    return null;
  }
  return { challengeId, method: methodFromForm(formData), expiresAt };
}

function methodFromForm(formData: FormData): MfaChallenge['method'] {
  const method = formData.get('method');
  if (method === 'sms' || method === 'recovery_code') {
    return method;
  }
  return 'totp';
}
