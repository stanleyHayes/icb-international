import { ERROR_STATUS, type ErrorCode, type ProblemDetails } from '@icb/contracts';
import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

import { isDomainError, type DomainError } from '../errors/domain.error.js';
import { CORRELATION_ID_HEADER } from '../observability/correlation.constants.js';
import { codeForStatus, PROBLEM_TYPE_BASE, titleFor } from './problem-details.constants.js';

/**
 * Turns every thrown value into RFC 9457 problem+json — the only error shape on the wire.
 * An unexpected error is logged in full and returned as an opaque INTERNAL_ERROR: internals
 * never leak to a caller.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const correlationId = this.readCorrelationId(request);

    const problem = this.toProblem(exception, request.url, correlationId);

    if (problem.status >= 500) {
      this.logger.error(
        { err: exception, correlationId, path: request.url },
        `Unhandled error: ${problem.detail}`,
      );
    } else {
      this.logger.debug({ correlationId, code: problem.code }, problem.detail);
    }

    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json; charset=utf-8')
      .send(problem);
  }

  private readCorrelationId(request: FastifyRequest): string {
    const header = request.headers[CORRELATION_ID_HEADER];
    return typeof header === 'string' ? header : 'unknown';
  }

  private toProblem(exception: unknown, instance: string, correlationId: string): ProblemDetails {
    if (isDomainError(exception)) {
      return this.fromDomainError(exception, instance, correlationId);
    }
    if (exception instanceof ZodError) {
      return this.fromZodError(exception, instance, correlationId);
    }
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, instance, correlationId);
    }
    return this.build('INTERNAL_ERROR', 'An unexpected error occurred', instance, correlationId);
  }

  private fromDomainError(
    error: DomainError,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    const problem = this.build(error.code, error.message, instance, correlationId);
    return {
      ...problem,
      ...(error.fieldErrors.length > 0 ? { errors: [...error.fieldErrors] } : {}),
      ...(error.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: error.retryAfterSeconds }),
    };
  }

  private fromZodError(error: ZodError, instance: string, correlationId: string): ProblemDetails {
    return {
      ...this.build('VALIDATION_FAILED', 'The request body failed validation', instance, correlationId),
      errors: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  private fromHttpException(
    exception: HttpException,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    const status = exception.getStatus();
    return {
      ...this.build(codeForStatus(status), exception.message, instance, correlationId),
      status,
    };
  }

  private build(
    code: ErrorCode,
    detail: string,
    instance: string,
    correlationId: string,
  ): ProblemDetails {
    return {
      type: `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replaceAll('_', '-')}`,
      title: titleFor(code),
      status: ERROR_STATUS[code],
      detail,
      instance,
      code,
      correlationId,
    };
  }
}
