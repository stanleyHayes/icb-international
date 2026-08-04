import { ApiError } from './api';

/** True when the API refused the call on role/permission grounds (403). */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** True when the API route does not exist yet (404). */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
