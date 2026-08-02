import { IcbUsageError } from './errors.js';
import { type PathParams, type QueryParams } from './http.js';

/** Replaces `:name` segments with URI-encoded values; a missing value is a usage error. */
export function interpolatePath(path: string, params: PathParams | undefined): string {
  return path.replace(/:([A-Za-z]+)/g, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined) {
      throw new IcbUsageError(`Missing path parameter "${name}" for ${path}`);
    }
    return encodeURIComponent(value);
  });
}

/** Serialises a query object: arrays repeat the key, null/undefined are dropped. */
export function serializeQuery(query: QueryParams | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(params, key, value);
  }
  const serialised = params.toString();
  return serialised === '' ? '' : `?${serialised}`;
}

function appendQueryValue(params: URLSearchParams, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    for (const item of value as unknown[]) appendQueryValue(params, key, item);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    params.append(key, String(value));
    return;
  }
  throw new IcbUsageError(`Unsupported query value for "${key}": expected string, number or boolean`);
}
