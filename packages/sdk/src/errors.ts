import { problemDetailsSchema, type ErrorCode, type ProblemDetails } from '@icb/contracts';

import { HEADER_CORRELATION_ID, MIME_JSON, UNKNOWN_CORRELATION_ID } from './constants.js';

/**
 * Typed error hierarchy for the SDK. Nothing here throws a bare `Error` — callers can
 * discriminate on the class (or on `IcbApiError.code`, the contract's ErrorCode union).
 */
export abstract class IcbError extends Error {
  abstract readonly kind: 'api' | 'network' | 'protocol' | 'usage';
}

/** A non-2xx response. Always carries the RFC 9457 problem the API returned (or a synthesised one). */
export class IcbApiError extends IcbError {
  readonly kind = 'api' as const;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(`${String(problem.status)} ${problem.code}: ${problem.detail}`);
    this.name = 'IcbApiError';
    this.problem = problem;
  }

  get code(): ErrorCode {
    return this.problem.code;
  }

  get status(): number {
    return this.problem.status;
  }

  get retryAfterSeconds(): number | undefined {
    return this.problem.retryAfterSeconds;
  }
}

/** The request never received a response (DNS, connection reset, CORS). */
export class IcbNetworkError extends IcbError {
  readonly kind = 'network' as const;

  constructor(cause: unknown) {
    super('The request failed before a response was received', { cause });
    this.name = 'IcbNetworkError';
  }
}

/** A 2xx response whose body did not satisfy the contract schema. */
export class IcbProtocolError extends IcbError {
  readonly kind = 'protocol' as const;

  constructor(detail: string) {
    super(`The response did not match the API contract: ${detail}`);
    this.name = 'IcbProtocolError';
  }
}

/** A programming error at the call site (missing path parameter, bad query value). */
export class IcbUsageError extends IcbError {
  readonly kind = 'usage' as const;

  constructor(detail: string) {
    super(detail);
    this.name = 'IcbUsageError';
  }
}

/** Best-effort ErrorCode for a response that did not carry a problem body. */
export function statusToErrorCode(status: number): ErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION_FAILED';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

export function synthesizeProblem(status: number, detail: string, correlationId: string): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Request failed',
    status,
    detail,
    code: statusToErrorCode(status),
    correlationId,
  };
}

/** Maps any non-2xx response onto an {@link IcbApiError}, parsing problem+json when present. */
export async function toApiError(response: Response): Promise<IcbApiError> {
  const correlationId = response.headers.get(HEADER_CORRELATION_ID) ?? UNKNOWN_CORRELATION_ID;
  const body: unknown = await response.json().catch(() => null);
  const parsed = problemDetailsSchema.safeParse(body);
  const problem = parsed.success
    ? parsed.data
    : synthesizeProblem(response.status, defaultDetail(response), correlationId);
  return new IcbApiError(problem);
}

function defaultDetail(response: Response): string {
  return `HTTP ${String(response.status)} ${response.statusText} without a ${MIME_JSON} problem body`;
}
