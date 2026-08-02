import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { performance } from 'node:perf_hooks';
import { catchError, tap, type Observable } from 'rxjs';

import { CORRELATION_ID_HEADER } from '../observability/correlation.constants.js';
import { redactPii } from './redact.js';

/**
 * One structured log line per request, on both success and failure.
 *
 * Bodies pass through `redactPii` before they are logged — a request/response log is the easiest
 * place for a PAN or password to leak, so it is the place that must be safest. Timing uses the
 * monotonic clock (`performance.now`), which is a duration measurement, not wall-clock time, so
 * the N8 clock rule does not apply.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const started = performance.now();
    const base = {
      method: request.method,
      url: request.url,
      correlationId: request.headers[CORRELATION_ID_HEADER],
    };

    this.logger.log({ ...base, body: redactPii(request.body) }, 'request');

    return next.handle().pipe(
      tap((body) => {
        this.logger.log(
          { ...base, statusCode: reply.statusCode, durationMs: elapsedMs(started), body: redactPii(body) },
          'response',
        );
      }),
      catchError((error: unknown) => {
        this.logger.error(
          { ...base, statusCode: reply.statusCode, durationMs: elapsedMs(started), err: error },
          'request failed',
        );
        throw error;
      }),
    );
  }
}

function elapsedMs(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}
