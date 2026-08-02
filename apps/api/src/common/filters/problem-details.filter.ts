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

const PROBLEM_TYPE_BASE = 'https://icb.example/problems';

const TITLES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'Validation failed',
  NOT_FOUND: 'Resource not found',
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'Not permitted',
  CONFLICT: 'Conflicting state',
  RATE_LIMITED: 'Too many requests',
  INTERNAL_ERROR: 'Something went wrong',
};

/** Framework exceptions arrive with a status but no ICB code; this maps one to the other. */
const STATUS_CODES: Readonly<Record<number, ErrorCode>> = {
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

function codeForStatus(status: number): ErrorCode {
  return STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED');
}

function titleFor(code: ErrorCode): string {
  return TITLES[code] ?? code.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Turns every thrown value into RFC 9457 problem+json.
 *
 * There is exactly one error shape on the wire. Clients parse one thing; support reads one
 * thing; the SDK maps one thing. An unexpected error is logged in full and returned as an opaque
 * INTERNAL_ERROR — internals never leak to a caller.
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
