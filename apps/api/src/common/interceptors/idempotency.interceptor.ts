import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { performance } from 'node:perf_hooks';
import { catchError, concatMap, of, type Observable } from 'rxjs';

import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator.js';
import { ConflictError, ValidationError } from '../errors/domain-errors.js';
import { IDEMPOTENCY_KEY_HEADER } from '../observability/correlation.constants.js';
import {
  IDEMPOTENCY_STORE,
  type IdempotencyRecord,
  type IdempotencyStore,
} from './idempotency-store.port.js';

/** How long a racing caller waits for the in-flight request to store its response. */
const REPLAY_WAIT_MS = 2_000;
const REPLAY_POLL_MS = 25;

/**
 * Enforces invariant N6: a mutating endpoint marked `@Idempotent()` is safe to retry.
 *
 * The protocol is claim → execute → save. `claim` atomically inserts a pending record behind
 * the unique `(scope, key)` index, so a parallel burst with the same key executes the handler
 * exactly once: the winner runs it and stores the response; each loser is told the key is
 * pending and waits briefly for that stored response, then replays it. A loser whose wait
 * expires — the winner crashed or is pathologically slow — gets a 409 rather than a second
 * execution, because executing twice is the failure this interceptor exists to prevent. When
 * the handler itself fails, the claim is released so the client's retry gets a fresh run.
 * Scope includes the caller and route, so one customer's key never replays another's request.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor<unknown, unknown> {
  constructor(
    @Inject(IDEMPOTENCY_STORE) private readonly store: IdempotencyStore,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Promise<Observable<unknown>> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const key = readKey(request);
    const scope = scopeOf(request);

    const claim = await this.store.claim(scope, key);
    if (claim.outcome === 'completed') {
      return replay(reply, claim.record);
    }
    if (claim.outcome === 'pending') {
      return this.replayAfterWait(scope, key, reply);
    }

    return next.handle().pipe(
      concatMap(async (body) => {
        await this.store.save({ scope, key, statusCode: reply.statusCode, body });
        return body;
      }),
      catchError(async (error: unknown) => {
        await this.store.release(scope, key);
        throw error;
      }),
    );
  }

  /** Another request holds the claim: wait for its stored response, then serve that. */
  private async replayAfterWait(
    scope: string,
    key: string,
    reply: FastifyReply,
  ): Promise<Observable<unknown>> {
    const record = await this.waitForStored(scope, key);
    if (record === null) {
      throw new ConflictError('Another request with this Idempotency-Key is still in flight');
    }
    return replay(reply, record);
  }

  /** Poll for the completed record until the wait budget is spent. */
  private async waitForStored(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const deadline = performance.now() + REPLAY_WAIT_MS;
    let record = await this.store.find(scope, key);
    while (record === null && performance.now() < deadline) {
      await delay(REPLAY_POLL_MS);
      record = await this.store.find(scope, key);
    }
    return record;
  }
}

function replay(reply: FastifyReply, record: IdempotencyRecord): Observable<unknown> {
  void reply.status(record.statusCode);
  return of(record.body);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readKey(request: FastifyRequest): string {
  const header = request.headers[IDEMPOTENCY_KEY_HEADER];
  if (typeof header !== 'string' || header.trim().length === 0) {
    throw new ValidationError('An Idempotency-Key header is required for this operation', [
      { path: IDEMPOTENCY_KEY_HEADER, message: 'Missing idempotency key' },
    ]);
  }
  return header;
}

function scopeOf(request: FastifyRequest): string {
  const caller = request.user?.sub ?? 'anonymous';
  return `${caller}:${request.method}:${request.routeOptions.url ?? request.url}`;
}
