import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CORRELATION_ID_HEADER, ENVIRONMENT_HEADER } from '../observability/correlation.constants.js';
import { currentCorrelationId } from '../observability/correlation.context.js';
import { CorrelationInterceptor } from './correlation.interceptor.js';

interface Fixture {
  request: { headers: Record<string, string> };
  reply: { header: ReturnType<typeof vi.fn> };
  context: ExecutionContext;
  handler: CallHandler;
}

function fixture(incoming?: string): Fixture {
  const request = { headers: incoming === undefined ? {} : { [CORRELATION_ID_HEADER]: incoming } };
  const reply = { header: vi.fn() };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  } as unknown as ExecutionContext;
  return { context, request, reply, handler: { handle: () => of('ok') } };
}

describe('CorrelationInterceptor', () => {
  it('echoes an incoming correlation id', async () => {
    const f = fixture('corr-123');
    await firstValueFrom(new CorrelationInterceptor().intercept(f.context, f.handler));

    expect(f.reply.header).toHaveBeenCalledWith(CORRELATION_ID_HEADER, 'corr-123');
  });

  it('generates an id when none arrives', async () => {
    const f = fixture();
    await firstValueFrom(new CorrelationInterceptor().intercept(f.context, f.handler));

    const [, id] = f.reply.header.mock.calls[0] as [string, string];
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(f.request.headers[CORRELATION_ID_HEADER]).toBe(id);
  });

  it('names the environment on every response', async () => {
    const f = fixture('corr-1');
    await firstValueFrom(new CorrelationInterceptor().intercept(f.context, f.handler));

    const names: unknown[] = f.reply.header.mock.calls.map((call) => call[0] as unknown);
    expect(names).toContain(ENVIRONMENT_HEADER);
  });

  // Last on purpose: `enterWith` binds the store to the test's own async resource, so this
  // must not run before a test that expects an empty scope.
  it('binds the correlation id to the async scope for downstream code to find', async () => {
    const f = fixture('corr-scoped');
    await firstValueFrom(new CorrelationInterceptor().intercept(f.context, f.handler));

    expect(currentCorrelationId()).toBe('corr-scoped');
  });
});
