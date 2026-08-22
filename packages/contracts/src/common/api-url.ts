/**
 * Resolution of the API base URL the browser apps call.
 *
 * The API mounts every route under a `/v1` global prefix (`apps/api/src/bootstrap.ts`), so a base
 * URL is only usable once that prefix is on the end of it. Two conventions had grown up around
 * that: the Next apps expected the prefix to be baked into `NEXT_PUBLIC_API_URL`, while `@icb/sdk`
 * expected a bare origin and appended the prefix itself. A deployment that set the variable the
 * other way round — `https://api.example.com`, the obvious reading of "API URL" — sent every
 * request one path segment short, and the API answered `Cannot POST /auth/register` rather than
 * anything a caller could diagnose.
 *
 * Normalising here means either spelling works and neither can silently 404.
 */

/** The version segment every API route is mounted under. */
export const API_VERSION_PREFIX = '/v1';

/** Removes trailing slashes without a regex (linters flag them as super-linear). */
function stripTrailingSlashes(url: string): string {
  let result = url;
  while (result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

/**
 * Returns `value` as an API base URL guaranteed to end in the version prefix, with no trailing
 * slash. Accepts a base that already carries the prefix, one that does not, and either with or
 * without trailing slashes.
 *
 * ```ts
 * resolveApiBaseUrl('https://api.icb.com')      // 'https://api.icb.com/v1'
 * resolveApiBaseUrl('https://api.icb.com/v1/')  // 'https://api.icb.com/v1'
 * ```
 */
export function resolveApiBaseUrl(value: string | undefined, fallback: string): string {
  const base = (value ?? '').trim() || fallback;
  const trimmed = stripTrailingSlashes(base);

  if (trimmed.endsWith(API_VERSION_PREFIX)) {
    return trimmed;
  }

  return `${trimmed}${API_VERSION_PREFIX}`;
}
