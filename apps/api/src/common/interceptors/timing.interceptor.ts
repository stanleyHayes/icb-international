import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { performance } from 'node:perf_hooks';
import { tap, type Observable } from 'rxjs';

/** Server-Timing metric name surfaces handler duration to APM scrapers and devtools. */
const TIMING_METRIC = 'app';

/**
 * Measures handler execution time and exposes it as a `Server-Timing` response header.
 *
 * The monotonic clock is used deliberately: this measures a duration, never a point in time, so
 * it stays correct under simulated time travel (N8) and NTP adjustments alike.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const reply = context.switchToHttp().getResponse<FastifyReply>();
    const started = performance.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Math.round((performance.now() - started) * 100) / 100;
        void reply.header('server-timing', `${TIMING_METRIC};dur=${durationMs}`);
      }),
    );
  }
}
