import { API_URL } from './paths';

/** Thin fetch helpers against the running API. Used by auth setup and fixture bootstrap. */

export interface LoginTokens {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly tokenType: string;
}

export interface MfaChallenge {
  readonly challengeId: string;
  readonly method: string;
  readonly expiresAt: string;
  readonly hint?: string;
}

export type LoginResult =
  | { readonly outcome: 'authenticated'; readonly accessToken: string }
  | { readonly outcome: 'mfa_required'; readonly challenge: MfaChallenge };

interface RawLoginBody {
  readonly outcome: string;
  readonly tokens?: LoginTokens;
  readonly challenge?: MfaChallenge;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    path: string,
    body: string,
  ) {
    super(`${path} -> ${status}: ${body.slice(0, 200)}`);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new ApiRequestError(response.status, path, text);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export async function apiLogin(email: string, password: string): Promise<LoginResult> {
  const body = await request<RawLoginBody>('/auth/login', { body: { email, password } });
  if (body.outcome === 'authenticated' && body.tokens) {
    return { outcome: 'authenticated', accessToken: body.tokens.accessToken };
  }
  if (body.outcome === 'mfa_required' && body.challenge) {
    return { outcome: 'mfa_required', challenge: body.challenge };
  }
  throw new Error(`unexpected login outcome: ${JSON.stringify(body).slice(0, 200)}`);
}

export async function apiMfaVerify(challenge: MfaChallenge, code: string): Promise<string> {
  const body = await request<{ tokens: LoginTokens }>('/auth/mfa/verify', {
    body: {
      challengeId: challenge.challengeId,
      method: challenge.method,
      expiresAt: challenge.expiresAt,
      code,
    },
  });
  return body.tokens.accessToken;
}

export async function apiTotpEnrol(token: string): Promise<string> {
  const body = await request<{ secret: string }>('/auth/totp/enrol', {
    method: 'POST',
    token,
    body: {},
  });
  return body.secret;
}

export async function apiTotpConfirm(token: string, code: string): Promise<void> {
  await request('/auth/totp/confirm', { method: 'POST', token, body: { code } });
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  return request<T>(path, { token });
}

export async function apiPost<T>(path: string, token: string, body: unknown): Promise<T> {
  return request<T>(path, { token, body });
}

/** List endpoints are a mix of arrays and cursor pages; normalise to a plain array. */
export function asItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body as Record<string, unknown>[];
  }
  if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    return (body as { items: Record<string, unknown>[] }).items;
  }
  return [];
}
