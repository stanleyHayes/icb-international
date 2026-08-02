import { MAX_REDACTION_DEPTH, REDACTED_VALUE, SENSITIVE_KEYS } from './redaction.constants.js';

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowered === sensitive || lowered.endsWith(sensitive));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-copies a value with every sensitive field replaced by `[redacted]`.
 *
 * Logging must never be a data-breach vector: request bodies, response payloads and error
 * contexts pass through here before they touch pino. Anything beyond `MAX_REDACTION_DEPTH` is
 * dropped rather than traversed — a log line is never worth a stack overflow.
 */
export function redactPii(value: unknown, depth = 0): unknown {
  if (depth > MAX_REDACTION_DEPTH) {
    return REDACTED_VALUE;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item, depth + 1));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED_VALUE : redactPii(entry, depth + 1);
  }
  return result;
}
