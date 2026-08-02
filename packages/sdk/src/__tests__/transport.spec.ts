import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { get, post, type EndpointDef } from '../endpoint.js';
import {
  IcbApiError,
  IcbNetworkError,
  IcbProtocolError,
  IcbUsageError,
} from '../errors.js';
import { createRefresher } from '../refresh.js';
import { createRequester, type TransportDeps } from '../transport.js';

const BASE_URL = 'http://api.test';
const AUTH_HEADER = 'authorization';
const IDEMPOTENCY_HEADER = 'idempotency-key';

const okSchema = z.object({ ok: z.boolean() });
const listEndpoint = get('/items', z.array(okSchema));
const itemEndpoint = get('/items/:itemId', okSchema);
const createEndpoint = post('/items', okSchema, { body: z.object({ name: z.string() }), idempotent: true });
const loginEndpoint = post('/auth/login', okSchema, { body: z.object({ email: z.string() }), auth: false });

type FetchHandler = (url: string, init: RequestInit) => Promise<Response>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problem(status: number, code: string): Record<string, unknown> {
  return {
    type: 'about:blank',
    title: 'Problem',
    status,
    detail: 'something went wrong',
    code,
    correlationId: 'corr-1',
  };
}

function harness(handler: FetchHandler, token: string | null = 'token-123') {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    const request = { url: String(url), init: init ?? {} };
    calls.push(request);
    return handler(request.url, request.init);
  }) as typeof fetch;
  const deps: TransportDeps = {
    baseUrl: BASE_URL,
    fetchFn,
    credentials: 'include',
    getAccessToken: token === null ? undefined : () => token,
    refresher: createRefresher({ baseUrl: BASE_URL, fetchFn, credentials: 'include', onTokensRefreshed: undefined }),
  };
  return { call: createRequester(deps), calls };
}

function header(init: RequestInit, name: string): string | undefined {
  return new Headers(init.headers).get(name) ?? undefined;
}

async function rejectsWith(promise: Promise<unknown>, ctor: new (...args: never[]) => Error) {
  await expect(promise).rejects.toBeInstanceOf(ctor);
}

describe('transport — auth header', () => {
  it('injects the bearer token on authenticated endpoints', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, [])));
    await call(listEndpoint);
    expect(header(calls[0]?.init ?? {}, AUTH_HEADER)).toBe('Bearer token-123');
  });

  it('omits the token on pre-auth endpoints', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, { ok: true })));
    await call(loginEndpoint, { body: { email: 'a@b.co' } });
    expect(header(calls[0]?.init ?? {}, AUTH_HEADER)).toBeUndefined();
  });

  it('works without a token provider (no header, no crash)', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, [])), null);
    await call(listEndpoint);
    expect(header(calls[0]?.init ?? {}, AUTH_HEADER)).toBeUndefined();
  });
});

describe('transport — refresh on 401', () => {
  const tokens = { accessToken: 'fresh-token', expiresIn: 900, tokenType: 'Bearer' };

  it('refreshes once for concurrent 401s and retries with the new token', async () => {
    const unauthorised = () => jsonResponse(401, problem(401, 'SESSION_EXPIRED'));
    const queue: Response[] = [unauthorised(), unauthorised(), jsonResponse(200, []), jsonResponse(200, [])];
    let refreshCalls = 0;
    const { call, calls } = harness((url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        refreshCalls += 1;
        return new Promise<Response>((resolve) =>
          setTimeout(() => resolve(jsonResponse(200, tokens)), 10),
        );
      }
      return Promise.resolve(queue.shift() ?? jsonResponse(200, []));
    });
    await Promise.all([call(listEndpoint), call(listEndpoint)]);
    expect(refreshCalls).toBe(1);
    const retried = calls.filter((c) => !c.url.endsWith('/v1/auth/refresh'));
    for (const retry of retried.slice(2)) {
      expect(header(retry.init, AUTH_HEADER)).toBe('Bearer fresh-token');
    }
  });

  it('does not retry a second 401', async () => {
    const unauthorised = jsonResponse(401, problem(401, 'SESSION_EXPIRED'));
    let refreshCalls = 0;
    const { call } = harness((url) => {
      if (url.endsWith('/v1/auth/refresh')) {
        refreshCalls += 1;
        return Promise.resolve(jsonResponse(200, tokens));
      }
      return Promise.resolve(unauthorised.clone());
    });
    await rejectsWith(call(listEndpoint), IcbApiError);
    expect(refreshCalls).toBe(1);
  });

  it('surfaces the refresh failure as a typed api error', async () => {
    const { call } = harness(() =>
      Promise.resolve(jsonResponse(401, problem(401, 'SESSION_EXPIRED'))),
    );
    const error = await call(listEndpoint).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IcbApiError);
    expect((error as IcbApiError).code).toBe('SESSION_EXPIRED');
  });

  it('never refreshes for pre-auth endpoints', async () => {
    let refreshCalls = 0;
    const { call } = harness((url) => {
      if (url.endsWith('/v1/auth/refresh')) refreshCalls += 1;
      return Promise.resolve(jsonResponse(401, problem(401, 'INVALID_CREDENTIALS')));
    });
    await rejectsWith(call(loginEndpoint, { body: { email: 'a@b.co' } }), IcbApiError);
    expect(refreshCalls).toBe(0);
  });
});

describe('transport — idempotency keys', () => {
  it('attaches a generated key to idempotent endpoints', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, { ok: true })));
    await call(createEndpoint, { body: { name: 'x' } });
    const key = header(calls[0]?.init ?? {}, IDEMPOTENCY_HEADER);
    expect(key).toBeDefined();
    expect(key?.length).toBeGreaterThanOrEqual(8);
  });

  it('respects a caller-supplied key and rejects malformed ones', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, { ok: true })));
    await call(createEndpoint, { body: { name: 'x' }, options: { idempotencyKey: 'pay-run-0042' } });
    expect(header(calls[0]?.init ?? {}, IDEMPOTENCY_HEADER)).toBe('pay-run-0042');
    await rejectsWith(
      call(createEndpoint, { body: { name: 'x' }, options: { idempotencyKey: 'short' } }),
      IcbUsageError,
    );
  });

  it('never sends a key on reads', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, [])));
    await call(listEndpoint);
    expect(header(calls[0]?.init ?? {}, IDEMPOTENCY_HEADER)).toBeUndefined();
  });
});

describe('transport — error mapping', () => {
  it('maps problem+json onto IcbApiError with the contract code', async () => {
    const { call } = harness(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ ...problem(429, 'RATE_LIMITED'), retryAfterSeconds: 30 }),
          { status: 429, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const error = await call(listEndpoint).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IcbApiError);
    expect((error as IcbApiError).code).toBe('RATE_LIMITED');
    expect((error as IcbApiError).status).toBe(429);
    expect((error as IcbApiError).retryAfterSeconds).toBe(30);
  });

  it('synthesises a problem when the body is not problem+json', async () => {
    const { call } = harness(() => Promise.resolve(new Response('oops', { status: 503 })));
    const error = await call(listEndpoint).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IcbApiError);
    expect((error as IcbApiError).code).toBe('SERVICE_UNAVAILABLE');
  });

  it('wraps transport failures in IcbNetworkError', async () => {
    const { call } = harness(() => Promise.reject(new TypeError('fetch failed')));
    await rejectsWith(call(listEndpoint), IcbNetworkError);
  });

  it('lets abort errors pass through untouched', async () => {
    const { call } = harness(() =>
      Promise.reject(new DOMException('The operation was aborted', 'AbortError')),
    );
    await expect(call(listEndpoint)).rejects.toBeInstanceOf(DOMException);
  });

  it('raises IcbProtocolError when a 2xx body violates the schema', async () => {
    const { call } = harness(() => Promise.resolve(jsonResponse(200, { ok: 'not-a-boolean' })));
    await rejectsWith(call(itemEndpoint, { params: { itemId: 'x' } }), IcbProtocolError);
  });
});

describe('transport — urls and query strings', () => {
  it('interpolates path params and serialises arrays, booleans and numbers', async () => {
    const { call, calls } = harness(() => Promise.resolve(jsonResponse(200, [])));
    const queryEndpoint: EndpointDef = get('/items/:itemId/entries', z.array(okSchema));
    await call(queryEndpoint, {
      params: { itemId: 'acc 1' },
      query: { type: ['fee', 'interest'], includePending: false, minMinorUnits: 100, cursor: undefined },
    });
    const url = calls[0]?.url ?? '';
    expect(url).toContain('/v1/items/acc%201/entries?');
    expect(url).toContain('type=fee&type=interest');
    expect(url).toContain('includePending=false');
    expect(url).toContain('minMinorUnits=100');
    expect(url).not.toContain('cursor');
  });

  it('rejects missing path params and non-scalar query values', async () => {
    const { call } = harness(() => Promise.resolve(jsonResponse(200, [])));
    await rejectsWith(call(itemEndpoint), IcbUsageError);
    await rejectsWith(
      call(listEndpoint, { query: { filter: { nested: true } } }),
      IcbUsageError,
    );
  });
});
