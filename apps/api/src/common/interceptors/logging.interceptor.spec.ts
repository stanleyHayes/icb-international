import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { firstValueFrom, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoggingInterceptor } from './logging.interceptor.js';
import { NotFoundError } from '../errors/domain-errors.js';
import { REDACTED_VALUE } from './redaction.constants.js';

interface Fixture {
  context: ExecutionContext;
  handler: CallHandler;
}

function fixture(body: unknown): Fixture {
  const request: Partial<FastifyRequest> = {
    method: 'POST',
    url: '/v1/transfers',
    headers: {},
    body,
  };
  const reply: Partial<FastifyReply> = { statusCode: 200 };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  } as unknown as ExecutionContext;
  return { context, handler: { handle: () => of({ ok: true }) } };
}

describe('LoggingInterceptor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the request with a redacted body', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const f = fixture({ amount: 500, password: 'hunter2' });

    await firstValueFrom(new LoggingInterceptor().intercept(f.context, f.handler));

    const [payload] = log.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(payload.body).toEqual({ amount: 500, password: REDACTED_VALUE });
  });

  it('logs the response with status and duration', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const f = fixture({});

    await firstValueFrom(new LoggingInterceptor().intercept(f.context, f.handler));

    const [payload, message] = log.mock.calls[1] as [
      { statusCode: number; durationMs: number },
      string,
    ];
    expect(message).toBe('response');
    expect(payload.statusCode).toBe(200);
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('logs failures and rethrows the original error', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const f = fixture({});
    const failure = new Error('boom');
    const failing: CallHandler = { handle: () => throwError(() => failure) };

    await expect(
      firstValueFrom(new LoggingInterceptor().intercept(f.context, failing)),
    ).rejects.toBe(failure);
    expect(errorLog).toHaveBeenCalledOnce();
  });

  it('logs the status the exception filter will send, not the pre-handler default', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const f = fixture({});
    const failure = new NotFoundError('Transfer', 'tr_1');
    const failing: CallHandler = { handle: () => throwError(() => failure) };

    await expect(
      firstValueFrom(new LoggingInterceptor().intercept(f.context, failing)),
    ).rejects.toBe(failure);

    const [payload] = errorLog.mock.calls[0] as [{ statusCode: number }];
    expect(payload.statusCode).toBe(404);
  });

  it('logs 500 for an error the filter cannot map', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const f = fixture({});
    const failing: CallHandler = { handle: () => throwError(() => new Error('boom')) };

    await expect(
      firstValueFrom(new LoggingInterceptor().intercept(f.context, failing)),
    ).rejects.toThrow('boom');

    const [payload] = errorLog.mock.calls[0] as [{ statusCode: number }];
    expect(payload.statusCode).toBe(500);
  });
});
