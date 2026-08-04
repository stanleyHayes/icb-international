import {
  HttpException,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { performance } from 'node:perf_hooks';
import { tap, type Observable } from 'rxjs';

import { MetricsService } from '../observability/metrics.service.js';

/** Server-Timing metric name surfaces handler duration to APM scrapers and devtools. */
const TIMING_METRIC = 'app';

/** Probes and the scrape itself must not pollute the latency distribution they report on. */
const UNMEASURED_PREFIXES = ['/health', '/metrics'];

/**
 * Measures handler execution time and exposes it two ways: a `Server-Timing` response header
 * for the caller, and the `icb_http_request_duration_ms` histogram for the fleet view.
 *
 * The route label is the Fastify route template (`/v1/transfers/:id`), never the concrete URL —
 * a label per customer id is a cardinality explosion, not a metric. The monotonic clock is used
 * deliberately: this measures a duration, never a point in time, so it stays correct under
 * simulated time travel (N8) and NTP adjustments alike.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const started = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Math.round((performance.now() - started) * 100) / 100;
          void reply.header('server-timing', `${TIMING_METRIC};dur=${durationMs}`);
          this.record(request, reply.statusCode, started);
        },
        // The exception filter sets the final status after this runs, so the status is read
        // from the error itself — same value the filter will choose.
        error: (error: unknown) => this.record(request, statusOf(error), started),
      }),
    );
  }

  private record(request: FastifyRequest, status: number, started: number): void {
    const route = request.routeOptions?.url ?? 'unmatched';
    if (UNMEASURED_PREFIXES.some((prefix) => route.startsWith(prefix))) {
      return;
    }
    this.metrics.httpRequest(performance.now() - started, {
      method: request.method,
      route,
      status,
    });
  }
}

function statusOf(error: unknown): number {
  return error instanceof HttpException ? error.getStatus() : 500;
}
