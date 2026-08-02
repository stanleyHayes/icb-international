import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { concatMap, of, type Observable } from 'rxjs';

import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator.js';
import { ValidationError } from '../errors/domain-errors.js';
import { IDEMPOTENCY_KEY_HEADER } from '../observability/correlation.constants.js';
import { IDEMPOTENCY_STORE, type IdempotencyStore } from './idempotency-store.port.js';

/**
 * Enforces invariant N6: a mutating endpoint marked `@Idempotent()` is safe to retry.
 *
 * First execution stores the response under `(scope, key)`; a replay with the same key returns
 * the stored response without re-running the handler, so a retried transfer posts exactly once.
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

    const existing = await this.store.find(scope, key);
    if (existing) {
      void reply.status(existing.statusCode);
      return of(existing.body);
    }

    return next.handle().pipe(
      concatMap(async (body) => {
        await this.store.save({ scope, key, statusCode: reply.statusCode, body });
        return body;
      }),
    );
  }
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
