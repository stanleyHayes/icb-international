import { ERROR_STATUS, type ErrorCode, type FieldError } from '@icb/contracts';

/**
 * The only kind of error the application layer throws.
 *
 * Carrying a stable `ErrorCode` means the HTTP status, the client-side branch, and the log
 * taxonomy all derive from one decision made at the throw site. Nothing downstream has to guess
 * from a message string.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fieldErrors: readonly FieldError[];
  readonly context: Readonly<Record<string, unknown>>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      fieldErrors?: readonly FieldError[];
      context?: Record<string, unknown>;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.fieldErrors = options.fieldErrors ?? [];
    this.context = Object.freeze({ ...options.context });
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
