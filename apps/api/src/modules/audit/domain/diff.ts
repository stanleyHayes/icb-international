import { redactPii } from '../../../common/interceptors/redact.js';
import { ABSENT_VALUE, CHANGE_VALUE_MAX_LENGTH } from '../audit.constants.js';
import type { AuditChange } from './audit-event.js';
import { canonicalJson } from './canonicalise.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringifyValue(value: unknown): string {
  if (value === undefined) {
    return ABSENT_VALUE;
  }
  const text = typeof value === 'string' ? value : canonicalJson(value);
  if (text.length <= CHANGE_VALUE_MAX_LENGTH) {
    return text;
  }
  return `${text.slice(0, CHANGE_VALUE_MAX_LENGTH)}...`;
}

/**
 * Masks a snapshot for storage. Always returns a plain object (or null) so the hash input has a
 * stable shape and the diff has fields to walk; scalars and arrays are wrapped under `value`.
 * Redaction happens here, before anything is persisted — the audit trail must never become a
 * second copy of the PII it watches.
 */
export function maskSnapshot(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return null;
  }
  const masked = redactPii(value);
  return isPlainObject(masked) ? masked : { value: masked };
}

/**
 * Top-level field diff between two masked snapshots. Flat by design: a nested change surfaces as
 * a whole-field replacement, which keeps rows readable in the console and the contract simple.
 */
export function diffChanges(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditChange[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort(
    (left, right) => left.localeCompare(right),
  );
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const beforeText = stringifyValue(before?.[field]);
    const afterText = stringifyValue(after?.[field]);
    if (beforeText !== afterText) {
      changes.push({ field, before: beforeText, after: afterText });
    }
  }
  return changes;
}
