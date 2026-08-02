import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Observable } from 'rxjs';

import { newId } from '../../infrastructure/database/identifier.js';
import { CORRELATION_ID_HEADER, ENVIRONMENT_HEADER } from '../observability/correlation.constants.js';

/**
 * Stamps every request with a correlation id and echoes it back.
 *
 * The id follows the request into logs, queue jobs, outbox events and audit entries, so a
 * support question ("what happened to my transfer at 14:02?") resolves to one searchable thread
 * instead of a guess.
 *
 * The environment header is the only outward trace of the simulation boundary — deliberately a
 * header and not a UI banner (agent_plan.md N1).
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const incoming = request.headers[CORRELATION_ID_HEADER];
    const correlationId = typeof incoming === 'string' && incoming.length > 0 ? incoming : newId();

    request.headers[CORRELATION_ID_HEADER] = correlationId;
    void reply.header(CORRELATION_ID_HEADER, correlationId);
    void reply.header(ENVIRONMENT_HEADER, 'simulation');

    return next.handle();
  }
}
