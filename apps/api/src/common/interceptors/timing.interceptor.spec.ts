import { HttpException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { MetricsService } from '../observability/metrics.service.js';
import { TimingInterceptor } from './timing.interceptor.js';

interface Reply {
  header: ReturnType<typeof vi.fn>;
  statusCode: number;
}

function replyStub(statusCode = 200): Reply {
  return { header: vi.fn(), statusCode };
}

/** Only the two accessors the interceptor reaches for; the rest of Fastify is irrelevant here. */
function contextWith(reply: Reply, route = '/v1/transfers/:id', method = 'POST'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ method, routeOptions: { url: route } }),
    }),
  } as unknown as ExecutionContext;
}

/**
 * The spy stays plainly typed for assertions (a class-typed view trips unbound-method);
 * the class-typed view only appears at the injection point.
 */
function metricsStub() {
  const httpRequest = vi.fn();
  return { httpRequest, service: { httpRequest } as unknown as MetricsService };
}

describe('TimingInterceptor', () => {
  it('sets a Server-Timing header with the handler duration', async () => {
    const reply = replyStub();
    const handler: CallHandler = { handle: () => of('done') };

    const result = new TimingInterceptor(metricsStub().service).intercept(contextWith(reply), handler);
    await expect(firstValueFrom(result)).resolves.toBe('done');

    const [name, value] = reply.header.mock.calls[0] as [string, string];
    expect(name).toBe('server-timing');
    expect(value).toMatch(/^app;dur=\d+(\.\d+)?$/);
  });

  it('records the histogram against the route template, never the concrete URL', async () => {
    const metrics = metricsStub();
    const handler: CallHandler = { handle: () => of('done') };

    await firstValueFrom(
      new TimingInterceptor(metrics.service).intercept(contextWith(replyStub(201)), handler),
    );

    expect(metrics.httpRequest).toHaveBeenCalledWith(expect.any(Number), {
      method: 'POST',
      route: '/v1/transfers/:id',
      status: 201,
    });
  });

  /**
   * A failed request is the one you most need latency for. The status comes from the error
   * because the exception filter has not run yet when this observes it.
   */
  it('still records a failure, at the status the exception filter will choose', async () => {
    const metrics = metricsStub();
    const handler: CallHandler = { handle: () => throwError(() => new HttpException('no', 422)) };

    await expect(
      firstValueFrom(new TimingInterceptor(metrics.service).intercept(contextWith(replyStub()), handler)),
    ).rejects.toThrow();

    expect(metrics.httpRequest).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ status: 422 }),
    );
  });

  it('leaves probes and the scrape itself out of the latency distribution', async () => {
    const metrics = metricsStub();
    const handler: CallHandler = { handle: () => of('ok') };

    for (const route of ['/health', '/metrics']) {
      await firstValueFrom(
        new TimingInterceptor(metrics.service).intercept(contextWith(replyStub(), route, 'GET'), handler),
      );
    }

    expect(metrics.httpRequest).not.toHaveBeenCalled();
  });
});
