import { Controller, Get, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ProblemDetailsFilter } from '../filters/problem-details.filter.js';
import { ThrottleGuard } from './throttle.guard.js';

const GLOBAL_LIMIT = 5;
const ROUTE_LIMIT = 2;
const WINDOW_MS = 60_000;
const SUB_HEADER = 'x-test-sub';

@Controller('probe')
class ProbeController {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }

  @Get('tight')
  @Throttle({ default: { limit: ROUTE_LIMIT, ttl: WINDOW_MS } })
  tight(): { ok: true } {
    return { ok: true };
  }
}

/**
 * Stands in for JwtAuthGuard: attaches the token claims the throttler tracks by. The subject
 * comes from a header so one test can play two users behind one IP.
 */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const sub = request.headers[SUB_HEADER] ?? 'load-test-user';
    (request as Record<string, unknown>)['user'] = { sub };
    return true;
  }
}

interface ProblemBody {
  status: number;
  code: string;
  retryAfterSeconds?: number;
}

/**
 * Runtime proof that throttling is enforced, not just configured.
 *
 * A load test saw no 429s at 500 rps from a single token; this harness boots the real
 * `ThrottleGuard` against the real `ThrottlerModule` storage and hammers one subject, so a
 * silently-disconnected guard (DI, ordering, tracker, storage) fails here instead of in prod.
 * No database or network port is involved — requests go through Fastify's `inject`.
 */
describe('ThrottleGuard enforcement (live harness)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: WINDOW_MS, limit: GLOBAL_LIMIT }])],
      controllers: [ProbeController],
      providers: [
        // Same ordering as AppModule: authentication first, throttler second.
        { provide: APP_GUARD, useClass: FakeAuthGuard },
        { provide: APP_GUARD, useClass: ThrottleGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalFilters(new ProblemDetailsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function hit(path: string, sub = 'user-a'): Promise<{ statusCode: number; body: string }> {
    const response = await app.inject({ method: 'GET', url: path, headers: { [SUB_HEADER]: sub } });
    return { statusCode: response.statusCode, body: response.body };
  }

  it('allows requests up to the limit, then answers 429 RATE_LIMITED with retryAfterSeconds', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < GLOBAL_LIMIT + 2; index += 1) {
      statuses.push((await hit('/probe', 'user-burst')).statusCode);
    }

    expect(statuses.slice(0, GLOBAL_LIMIT)).toEqual(Array(GLOBAL_LIMIT).fill(200));
    expect(statuses[GLOBAL_LIMIT]).toBe(429);

    const problem = JSON.parse((await hit('/probe', 'user-burst')).body) as ProblemBody;
    expect(problem.status).toBe(429);
    expect(problem.code).toBe('RATE_LIMITED');
    expect(problem.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks per subject: a blocked user does not block a neighbour on the same IP', async () => {
    for (let index = 0; index < GLOBAL_LIMIT + 1; index += 1) {
      await hit('/probe', 'user-hog');
    }
    expect((await hit('/probe', 'user-hog')).statusCode).toBe(429);
    expect((await hit('/probe', 'user-quiet')).statusCode).toBe(200);
  });

  it('enforces a tighter per-route @Throttle limit over the global one', async () => {
    const statuses: number[] = [];
    for (let index = 0; index < ROUTE_LIMIT + 2; index += 1) {
      statuses.push((await hit('/probe/tight', 'user-tight')).statusCode);
    }

    expect(statuses).toEqual([200, 200, 429, 429]);
  });
});
