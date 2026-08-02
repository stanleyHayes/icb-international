import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import type { IdempotencyRecord, IdempotencyStore } from './idempotency-store.port.js';

interface FakeRequest {
  method: string;
  url: string;
  routeOptions: { url: string };
  user: { sub: string };
  headers: Record<string, string>;
}

interface Fixture {
  store: IdempotencyStore & { saved: IdempotencyRecord[] };
  request: FakeRequest;
  reply: { statusCode: number; status: (code: number) => void };
  context: ExecutionContext;
  handler: CallHandler;
}

function fixture(options: {
  idempotent: boolean;
  key?: string;
  existing?: IdempotencyRecord | null;
}): Fixture {
  const saved: IdempotencyRecord[] = [];
  const store = {
    saved,
    find: vi.fn().mockResolvedValue(options.existing ?? null),
    save: vi.fn((record: IdempotencyRecord) => {
      saved.push(record);
      return Promise.resolve();
    }),
  };
  const request = {
    method: 'POST',
    url: '/v1/transfers?x=1',
    routeOptions: { url: '/v1/transfers' },
    user: { sub: 'cust-1' },
    headers: options.key === undefined ? {} : { 'idempotency-key': options.key },
  };
  const reply = { statusCode: 200, status: vi.fn((code: number) => (reply.statusCode = code)) };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  const handler = { handle: vi.fn(() => of({ id: 'tr_1' })) };
  return { store, request, reply, context, handler };
}

function interceptorFor(f: Fixture, idempotent: boolean): IdempotencyInterceptor {
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(idempotent) };
  return new IdempotencyInterceptor(f.store, reflector as never);
}

describe('IdempotencyInterceptor', () => {
  it('passes through untouched when the handler is not idempotent', async () => {
    const f = fixture({ idempotent: false });
    const result = await interceptorFor(f, false).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).resolves.toEqual({ id: 'tr_1' });
    expect(f.store.find).not.toHaveBeenCalled();
  });

  it('rejects a mutating call without an Idempotency-Key', async () => {
    const f = fixture({ idempotent: true });
    await expect(interceptorFor(f, true).intercept(f.context, f.handler)).rejects.toThrowError(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });

  it('executes once and stores the response', async () => {
    const f = fixture({ idempotent: true, key: 'key-1' });
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).resolves.toEqual({ id: 'tr_1' });
    expect(f.store.saved).toEqual([
      { scope: 'cust-1:POST:/v1/transfers', key: 'key-1', statusCode: 200, body: { id: 'tr_1' } },
    ]);
  });

  it('replays the stored response without running the handler', async () => {
    const existing: IdempotencyRecord = {
      scope: 'cust-1:POST:/v1/transfers',
      key: 'key-1',
      statusCode: 201,
      body: { id: 'tr_original' },
    };
    const f = fixture({ idempotent: true, key: 'key-1', existing });
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).resolves.toEqual({ id: 'tr_original' });
    expect(f.handler.handle).not.toHaveBeenCalled();
    expect(f.reply.status).toHaveBeenCalledWith(201);
  });

  it('scopes keys per caller', async () => {
    const f = fixture({ idempotent: true, key: 'key-1' });
    f.request.user = { sub: 'cust-2' };
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await firstValueFrom(result);
    expect(f.store.find).toHaveBeenCalledWith('cust-2:POST:/v1/transfers', 'key-1');
  });
});
