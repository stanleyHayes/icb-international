import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { mergeMap, type Observable } from 'rxjs';

import { AUDIT_ACTION_KEY } from '../../../common/decorators/audit-action.decorator.js';
import { AuditService } from '../audit.service.js';
import { actorFromClaims, correlationIdFrom, subjectFromRequest } from './request-enrichment.js';

/**
 * Turns `@AuditAction('account.freeze')` into a hash-chained audit event (agent_plan.md N7).
 *
 * The recorded event carries the masked request body as `before` and the masked response body as
 * `after`; modules that know the entity diff (auth, KYC decisions, account status changes) call
 * `AuditService.record()` directly with real snapshots instead.
 *
 * The write is awaited before the response completes so a `200` always implies the trail exists.
 * A persistence failure is logged, not thrown: the operation has already committed by then, and
 * converting a succeeded action into a client-facing error would misreport reality.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (action === undefined || context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    return next.handle().pipe(
      mergeMap(async (responseBody: unknown) => {
        await this.persist(action, request, responseBody);
        return responseBody;
      }),
    );
  }

  private async persist(
    action: string,
    request: FastifyRequest,
    responseBody: unknown,
  ): Promise<void> {
    try {
      await this.audit.record({
        actor: actorFromClaims(request.user),
        action,
        subject: subjectFromRequest(request),
        before: request.body,
        after: responseBody,
        ipAddress: request.ip,
        correlationId: correlationIdFrom(request),
      });
    } catch (error) {
      this.logger.error(
        `Failed to append audit event for ${action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
