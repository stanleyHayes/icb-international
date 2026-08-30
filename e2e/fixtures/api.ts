import { request, type APIRequestContext } from 'playwright/test';

import { env } from './env';

/**
 * Minimal typed client for the ICB API, used for staff-side steps and test setup.
 *
 * Anything the *customer* does in a journey goes through the browser; this client exists for
 * the steps a real bank's back office performs (KYC decision, dispute advance, loan approval,
 * fraud release) and for arranging fixtures (extra accounts, seed verification). It keeps the
 * specs free of raw fetch plumbing and every payload shape is declared at the call site.
 */

export interface Session {
  readonly accessToken: string;
  readonly customerId: string | null;
  readonly userId: string;
}

interface LoginResponse {
  readonly outcome: string;
  readonly tokens: { accessToken: string };
  readonly user: { userId: string; customerId: string | null };
}

/**
 * Session cache. The API throttles authentication endpoints to 5 attempts per minute per IP
 * (throttle.constants.ts), and a journey that logged in every persona fresh would trip it on
 * its own. Tokens live 15 minutes; reuse them for 8. Playwright runs this suite with one
 * worker, so a module-level cache is shared by every test in the run.
 */
const sessionCache = new Map<string, { client: ApiClient; expiresAt: number }>();
const SESSION_REUSE_MS = 8 * 60_000;

export class ApiClient {
  private constructor(
    private readonly ctx: APIRequestContext,
    private readonly token: string | null,
  ) {}

  static async login(email: string, password: string): Promise<ApiClient> {
    const cached = sessionCache.get(email);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.client;
    }
    const ctx = await request.newContext({ baseURL: env.apiUrl });
    let response = await ctx.post('/v1/auth/login', { data: { email, password } });
    if (response.status() === 429) {
      // Out of login budget for this window; wait it out once rather than fail the journey.
      await new Promise((resolve) => setTimeout(resolve, 61_000));
      response = await ctx.post('/v1/auth/login', { data: { email, password } });
    }
    if (!response.ok()) {
      const detail = await response.text();
      await ctx.dispose();
      throw new Error(`login failed for ${email}: ${response.status()} ${detail.slice(0, 200)}`);
    }
    const body = (await response.json()) as LoginResponse;
    if (body.outcome === 'authenticated') {
      const client = new ApiClient(ctx, body.tokens.accessToken);
      sessionCache.set(email, { client, expiresAt: Date.now() + SESSION_REUSE_MS });
      return client;
    }
    await ctx.dispose();
    throw new Error(`login for ${email} returned outcome=${body.outcome} (not expected in seed)`);
  }

  static anonymous(): Promise<ApiClient> {
    return request
      .newContext({ baseURL: env.apiUrl })
      .then((ctx) => new ApiClient(ctx, null));
  }

  async get<T>(path: string): Promise<T> {
    const response = await this.ctx.get(`/v1${path}`, { headers: this.auth() });
    await this.assertOk(response, 'GET', path);
    return (await response.json()) as T;
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.ctx.post(`/v1${path}`, { data, headers: this.mutation() });
    await this.assertOk(response, 'POST', path);
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** POST that tolerates an expected non-2xx and returns the raw status for assertions. */
  async postRaw(path: string, data?: unknown): Promise<{ status: number; body: unknown }> {
    const response = await this.ctx.post(`/v1${path}`, { data, headers: this.mutation() });
    return { status: response.status(), body: await response.json().catch(() => null) };
  }

  async dispose(): Promise<void> {
    // Sessions are cached for reuse (see login); their request contexts live and die with the
    // test process, so disposing per-test would poison the cache. Deliberately a no-op.
    await Promise.resolve();
  }

  private auth(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {};
  }

  /** Money mutations demand an Idempotency-Key (§1); each call gets a fresh one. */
  private mutation(): Record<string, string> {
    return { ...this.auth(), 'idempotency-key': crypto.randomUUID() };
  }

  private async assertOk(
    response: Awaited<ReturnType<APIRequestContext['get']>>,
    method: string,
    path: string,
  ): Promise<void> {
    if (!response.ok()) {
      throw new Error(
        `${method} ${path} -> ${response.status()}: ${(await response.text()).slice(0, 300)}`,
      );
    }
  }
}

/** True when the API answers /health; used by the stack preflight, never to skip silently. */
export async function apiReachable(): Promise<boolean> {
  try {
    const ctx = await request.newContext({ baseURL: env.apiUrl, timeout: 5_000 });
    const ok = (await ctx.get('/health')).ok();
    await ctx.dispose();
    return ok;
  } catch {
    return false;
  }
}
