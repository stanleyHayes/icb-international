import 'server-only';

import { resolveApiBaseUrl } from '@icb/contracts';
import type { ProblemDetails } from '@icb/contracts';
import { redirect } from 'next/navigation';

import { readSession } from './session';

const API_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4100/v1');

/**
 * Thrown for any non-2xx response, carrying the API's problem-details payload.
 *
 * Callers switch on `code`, which is a value from the shared contract, so a UI branch never
 * depends on matching an error message string.
 */
export class ApiError extends Error {
  constructor(
    readonly problem: ProblemDetails,
    readonly status: number,
  ) {
    super(problem.detail);
    this.name = 'ApiError';
  }

  get code(): ProblemDetails['code'] {
    return this.problem.code;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Requests without a session, e.g. login. */
  anonymous?: boolean;
  idempotencyKey?: string;
  /** Next.js cache tags so a mutation can invalidate exactly what it changed. */
  tags?: string[];
  revalidate?: number | false;
}

const FALLBACK_PROBLEM: ProblemDetails = {
  type: 'about:blank',
  title: 'Request failed',
  status: 500,
  detail: 'The request could not be completed.',
  code: 'INTERNAL_ERROR',
  correlationId: 'unknown',
};

async function buildHeaders(options: RequestOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = { accept: 'application/json' };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (options.idempotencyKey) {
    headers['idempotency-key'] = options.idempotencyKey;
  }
  if (!options.anonymous) {
    const session = await readSession();
    if (!session) {
      redirect('/login');
    }
    headers['authorization'] = `Bearer ${session.accessToken}`;
  }

  return headers;
}

async function fail(response: Response, anonymous: boolean): Promise<never> {
  const problem = (await response.json().catch(() => null)) as ProblemDetails | null;

  // An expired token is not an error the caller should handle — it means "sign in again".
  if (response.status === 401 && !anonymous) {
    redirect('/login?reason=expired');
  }

  throw new ApiError(problem ?? { ...FALLBACK_PROBLEM, status: response.status }, response.status);
}

/**
 * Call the ICB API from the server.
 *
 * Every request is made server-side with the token pulled from the sealed session, so no token
 * or account data ever passes through the client bundle.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: await buildHeaders(options),
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    next: {
      ...(options.tags ? { tags: options.tags } : {}),
      revalidate: options.revalidate === undefined ? 0 : options.revalidate,
    },
  });

  if (!response.ok) {
    await fail(response, options.anonymous ?? false);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Raw fetch used by the login action, which needs the Set-Cookie header off the response. */
export async function apiRaw(
  path: string,
  body: unknown,
): Promise<{ response: Response; data: unknown }> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return { response, data: await response.json().catch(() => null) };
}
