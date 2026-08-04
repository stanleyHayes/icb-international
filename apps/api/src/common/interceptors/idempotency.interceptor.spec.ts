import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import type {
  IdempotencyClaim,
  IdempotencyRecord,
  IdempotencyStore,
} from './idempotency-store.port.js';

interface FakeRequest {
  method: string;
  url: string;
  routeOptions: { url: string };
  user: { sub: string };
  headers: Record<string, string>;
}

interface Fixture {
  store: IdempotencyStore;
  saved: IdempotencyRecord[];
  claim: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
  handle: ReturnType<typeof vi.fn>;
  request: FakeRequest;
  reply: { statusCode: number; status: (code: number) => void };
  context: ExecutionContext;
  handler: CallHandler;
}

const STORED: IdempotencyRecord = {
  scope: 'cust-1:POST:/v1/transfers',
  key: 'key-1',
  statusCode: 201,
  body: { id: 'tr_original' },
};

function fixture(options: {
  idempotent: boolean;
  key?: string;
  claim?: IdempotencyClaim;
  found?: IdempotencyRecord | null;
  handlerError?: Error;
}): Fixture {
  const saved: IdempotencyRecord[] = [];
  const claim = vi.fn().mockResolvedValue(options.claim ?? { outcome: 'claimed' });
  const find = vi.fn().mockResolvedValue(options.found ?? null);
  const save = vi.fn((record: IdempotencyRecord) => {
    saved.push(record);
    return Promise.resolve();
  });
  const release = vi.fn().mockResolvedValue(undefined);
  const store: IdempotencyStore = { claim, find, save, release };
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
  const handle = vi.fn(() =>
    options.handlerError ? throwError(() => options.handlerError) : of({ id: 'tr_1' }),
  );
  const handler: CallHandler = { handle };
  return { store, saved, claim, find, release, handle, request, reply, context, handler };
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
    expect(f.claim).not.toHaveBeenCalled();
  });

  it('rejects a mutating call without an Idempotency-Key', async () => {
    const f = fixture({ idempotent: true });
    await expect(interceptorFor(f, true).intercept(f.context, f.handler)).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
    expect(f.claim).not.toHaveBeenCalled();
  });

  it('claims the key, executes once and stores the response', async () => {
    const f = fixture({ idempotent: true, key: 'key-1' });
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).resolves.toEqual({ id: 'tr_1' });
    expect(f.claim).toHaveBeenCalledWith('cust-1:POST:/v1/transfers', 'key-1');
    expect(f.saved).toEqual([
      { scope: 'cust-1:POST:/v1/transfers', key: 'key-1', statusCode: 200, body: { id: 'tr_1' } },
    ]);
  });

  it('replays the stored response without running the handler', async () => {
    const f = fixture({
      idempotent: true,
      key: 'key-1',
      claim: { outcome: 'completed', record: STORED },
    });
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).resolves.toEqual({ id: 'tr_original' });
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.reply.status).toHaveBeenCalledWith(201);
  });

  it('scopes keys per caller', async () => {
    const f = fixture({ idempotent: true, key: 'key-1' });
    f.request.user = { sub: 'cust-2' };
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await firstValueFrom(result);
    expect(f.claim).toHaveBeenCalledWith('cust-2:POST:/v1/transfers', 'key-1');
  });

  it('waits out an in-flight claim and replays the winner\'s stored response', async () => {
    const f = fixture({ idempotent: true, key: 'key-1', claim: { outcome: 'pending' } });
    f.find.mockResolvedValue(STORED);
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).resolves.toEqual({ id: 'tr_original' });
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.reply.status).toHaveBeenCalledWith(201);
  });

  it('conflicts rather than double-executing when the in-flight request never finishes', async () => {
    const f = fixture({ idempotent: true, key: 'key-1', claim: { outcome: 'pending' } });

    await expect(interceptorFor(f, true).intercept(f.context, f.handler)).rejects.toThrow(
      expect.objectContaining({ code: 'CONFLICT' }) as Error,
    );
    expect(f.handle).not.toHaveBeenCalled();
    expect(f.saved).toEqual([]);
  }, 10_000);

  it('releases the claim when the handler fails, so a retry gets a fresh run', async () => {
    const f = fixture({ idempotent: true, key: 'key-1', handlerError: new Error('boom') });
    const result = await interceptorFor(f, true).intercept(f.context, f.handler);

    await expect(firstValueFrom(result)).rejects.toThrow('boom');
    expect(f.release).toHaveBeenCalledWith('cust-1:POST:/v1/transfers', 'key-1');
    expect(f.saved).toEqual([]);
  });
});
