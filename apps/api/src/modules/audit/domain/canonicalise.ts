function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalise(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalise(item));
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalise(entry)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * Canonical JSON for hashing: object keys sorted at every depth, `Date` as ISO-8601, `undefined`
 * dropped. Two events with the same meaning must produce the same bytes — otherwise the hash
 * chain verifies nothing, because a verifier could never reproduce the writer's input.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalise(value));
}
