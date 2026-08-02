import request from 'supertest';
import type { Test } from 'supertest';

/**
 * Authenticated supertest agent.
 *
 * Wraps a Nest application's HTTP server so every request carries `Authorization: Bearer …`,
 * and mutating verbs carry an `Idempotency-Key` when one is configured (agent_plan.md N6 —
 * the API rejects mutating money endpoints without it).
 */

/** Structural type so this package never imports `@nestjs/common`. */
export interface HttpServerProvider {
  getHttpServer(): unknown;
}

type SupertestApp = Parameters<typeof request>[0];

export interface AuthenticatedAgentOptions {
  /** A Nest `INestApplication` (or anything with `getHttpServer()`). */
  readonly app: HttpServerProvider;
  readonly token: string;
  /** Applied to POST/PUT/PATCH/DELETE. Omit for suites that set their own per request. */
  readonly idempotencyKey?: string;
}

export interface AuthenticatedAgent {
  readonly token: string;
  get(path: string): Test;
  post(path: string): Test;
  put(path: string): Test;
  patch(path: string): Test;
  delete(path: string): Test;
}

const BEARER_PREFIX = 'Bearer ';
type MutatingMethod = 'post' | 'put' | 'patch' | 'delete';

export function createAuthenticatedAgent(options: AuthenticatedAgentOptions): AuthenticatedAgent {
  const server = options.app.getHttpServer() as SupertestApp;
  const authorise = (test: Test, mutating: boolean): Test => {
    const withAuth = test.set('Authorization', `${BEARER_PREFIX}${options.token}`);
    if (mutating && options.idempotencyKey != null) {
      return withAuth.set('Idempotency-Key', options.idempotencyKey);
    }
    return withAuth;
  };
  const call = (method: MutatingMethod | 'get', path: string): Test =>
    authorise(request(server)[method](path), method !== 'get');
  return {
    token: options.token,
    get: (path) => call('get', path),
    post: (path) => call('post', path),
    put: (path) => call('put', path),
    patch: (path) => call('patch', path),
    delete: (path) => call('delete', path),
  };
}
