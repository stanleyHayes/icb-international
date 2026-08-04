import { ulid } from 'ulid';
import request from 'supertest';
import { expect, type TestContext } from 'vitest';

import type { OperationSpec } from '@icb/contracts/openapi/spec';
import { ALL_OPERATIONS } from '@icb/contracts/openapi';
import type { ContractApp } from './harness.js';

const API_PREFIX = '/v1';

const OPERATIONS: ReadonlyMap<string, OperationSpec> = new Map(
  ALL_OPERATIONS.map((op) => [op.operationId, op]),
);

/** Look up the route-table entry for an operation; a typo here is a test bug, so fail loudly. */
export function operationOf(operationId: string): OperationSpec {
  const op = OPERATIONS.get(operationId);
  if (!op) {
    throw new Error(`No operation '${operationId}' in the OpenAPI route tables.`);
  }
  return op;
}

/** Substitute `{param}` placeholders in a route-table path template. */
export function fillPath(template: string, params: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter '${name}' for ${template}`);
    }
    return encodeURIComponent(value);
  });
}

type Role = 'customer' | 'staff' | 'none';

/**
 * Per-suite facade over the booted application.
 *
 * Two jobs: make requests with the right principal, and pin every 2xx body to its route-table
 * schema. `expectContract` is the whole point of the suite — it asserts the status the contract
 * declares, `schema.parse()`s the body (zod strips nothing silently here; an unexpected shape
 * throws), and records the operation as covered so `assertCovered` can prove 100% of a domain's
 * GET endpoints were exercised.
 */
export class ContractContext {
  private readonly covered = new Set<string>();
  private readonly gaps = new Map<string, string>();

  constructor(private readonly target: ContractApp) {}

  /**
   * The instant the booted application calls "now" — the same clock the seeder wrote history
   * against. Suites build their windows and timestamps from here; a zero-argument `Date` would
   * read the host clock and drift away from a simulated one (N8).
   */
  now(): Date {
    return this.target.clock.now();
  }

  /** Server supertest binds; an ephemeral port per suite keeps parallel workers apart. */
  private get server(): unknown {
    return this.target.app.getHttpAdapter().getInstance().server;
  }

  private tokenFor(role: Role): string | null {
    if (role === 'customer') return this.target.customerToken;
    if (role === 'staff') return this.target.staffToken;
    return null;
  }

  get(path: string, role: Role = 'customer'): request.Test {
    return this.authorise(request(this.server as never).get(API_PREFIX + path), role);
  }

  post(path: string, body: object, role: Role = 'customer'): request.Test {
    return this.authorise(
      request(this.server as never).post(API_PREFIX + path).send(body),
      role,
    );
  }

  put(path: string, body: object, role: Role = 'customer'): request.Test {
    return this.authorise(request(this.server as never).put(API_PREFIX + path).send(body), role);
  }

  patch(path: string, body: object, role: Role = 'customer'): request.Test {
    return this.authorise(
      request(this.server as never).patch(API_PREFIX + path).send(body),
      role,
    );
  }

  delete(path: string, role: Role = 'customer'): request.Test {
    return this.authorise(request(this.server as never).delete(API_PREFIX + path), role);
  }

  /** Mutations carry a fresh idempotency key (N6); the header is never asserted on. */
  private authorise(test: request.Test, role: Role): request.Test {
    const token = this.tokenFor(role);
    const withKey = test.set('Idempotency-Key', ulid());
    return token === null ? withKey : withKey.set('Authorization', `Bearer ${token}`);
  }

  /**
   * Assert a response matches its route-table contract: the declared success status and a body
   * its schema parses. Returns the parsed body for follow-up assertions.
   *
   * Coverage is recorded once the endpoint answered with the contracted status — a body that
   * then fails `parse` is drift the suite surfaces (often via `it.fails`), not an endpoint that
   * was never exercised.
   */
  expectContract(operationId: string, response: request.Response): unknown {
    const op = operationOf(operationId);
    expect(
      response.status,
      `${operationId} ${op.method.toUpperCase()} ${op.path} — expected ${op.response.status}, got ${response.status}: ${JSON.stringify(response.body)}`,
    ).toBe(op.response.status);
    this.covered.add(operationId);
    if (!op.response.schema) {
      return undefined;
    }
    return op.response.schema.parse(response.body);
  }

  /**
   * Register an endpoint that cannot be covered from seeded data (or drifts today), with the
   * reason. Gaps are excluded from `assertCovered` but printed in its failure output, so an
   * undocumented hole can never slip through silently.
   */
  gap(operationId: string, reason: string): void {
    operationOf(operationId);
    this.gaps.set(operationId, reason);
  }

  /** afterAll hook: prove every GET in this domain's route table was exercised or excused. */
  assertCovered(domainOps: readonly OperationSpec[]): void {
    const gets = domainOps.filter((op) => op.method === 'get');
    const missing = gets.filter((op) => !this.covered.has(op.operationId) && !this.gaps.has(op.operationId));
    const excused = gets
      .filter((op) => this.gaps.has(op.operationId))
      .map((op) => `    ${op.operationId} — ${this.gaps.get(op.operationId)}`);
    if (excused.length > 0) {
      // Visible in every run: coverage is complete only because these are consciously excused.
      console.warn(`Contract coverage gaps (${excused.length}):\n${excused.join('\n')}`);
    }
    expect(
      missing.map((op) => op.operationId),
      `Uncovered GET endpoints: ${missing.map((op) => op.operationId).join(', ')}`,
    ).toEqual([]);
  }
}

/**
 * Skip guard for infra-dependent tests. When Mongo was unreachable at boot, each test skips
 * with the recorded reason instead of failing — an absent replica set is an environment fact,
 * not a regression.
 */
export function requireInfra(
  t: TestContext,
  boot: { available: boolean; reason?: string },
): void {
  if (!boot.available) {
    t.skip(`Contract tests need MongoDB: ${boot.reason ?? 'unavailable'}`);
  }
}
