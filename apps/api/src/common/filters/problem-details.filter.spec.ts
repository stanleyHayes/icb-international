import { HttpException, type ArgumentsHost } from '@nestjs/common';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError, RateLimitedError, ValidationError } from '../errors/domain-errors.js';
import { CORRELATION_ID_HEADER } from '../observability/correlation.constants.js';
import { ProblemDetailsFilter } from './problem-details.filter.js';

interface Captured {
  statusCode: number;
  contentType: string;
  body: Record<string, unknown>;
}

function catchWith(exception: unknown, correlationId?: string): Captured {
  const captured: Partial<Captured> = {};
  const reply = {
    status: vi.fn((code: number) => {
      captured.statusCode = code;
      return reply;
    }),
    header: vi.fn((_name: string, value: string) => {
      captured.contentType = value;
      return reply;
    }),
    send: vi.fn((body: Record<string, unknown>) => {
      captured.body = body;
      return reply;
    }),
  };
  const request = {
    url: '/v1/accounts/acc-1',
    headers: correlationId === undefined ? {} : { [CORRELATION_ID_HEADER]: correlationId },
  };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  } as unknown as ArgumentsHost;

  new ProblemDetailsFilter().catch(exception, host);
  return captured as Captured;
}

describe('ProblemDetailsFilter', () => {
  it('maps a domain error to its status, code and correlation id', () => {
    const result = catchWith(new NotFoundError('Account', 'acc-1'), 'corr-9');

    expect(result.statusCode).toBe(404);
    expect(result.contentType).toContain('application/problem+json');
    expect(result.body).toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      correlationId: 'corr-9',
      instance: '/v1/accounts/acc-1',
    });
  });

  it('carries field errors on validation failures', () => {
    const error = new ValidationError('bad input', [{ path: 'amount', message: 'Required' }]);
    const result = catchWith(error);

    expect(result.statusCode).toBe(422);
    expect(result.body['errors']).toEqual([{ path: 'amount', message: 'Required' }]);
  });

  it('carries retryAfterSeconds on rate limiting', () => {
    const result = catchWith(new RateLimitedError(30));

    expect(result.statusCode).toBe(429);
    expect(result.body['retryAfterSeconds']).toBe(30);
  });

  it('maps a ZodError to field-level detail', () => {
    const parsed = z.object({ name: z.string() }).safeParse({ name: 42 });
    if (parsed.success) {
      throw new Error('expected parse failure');
    }
    const result = catchWith(parsed.error);

    expect(result.statusCode).toBe(422);
    expect(result.body['code']).toBe('VALIDATION_FAILED');
    expect(result.body['errors']).toEqual([
      expect.objectContaining({ path: 'name' }),
    ]);
  });

  it('maps a framework HttpException by status', () => {
    const result = catchWith(new HttpException('No route', 404));

    expect(result.statusCode).toBe(404);
    expect(result.body['code']).toBe('NOT_FOUND');
  });

  it('returns an opaque INTERNAL_ERROR for unexpected exceptions', () => {
    const result = catchWith(new Error('database connection string leaked here'));

    expect(result.statusCode).toBe(500);
    expect(result.body['code']).toBe('INTERNAL_ERROR');
    expect(result.body['detail']).not.toContain('database');
  });
});
