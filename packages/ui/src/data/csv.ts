/**
 * CSV serialisation for table export.
 *
 * Pure functions — no DOM — so they are testable in a node environment and reusable by any
 * export flow, not just DataTable. Follows RFC 4180: comma-separated, `"` doubled inside quoted
 * cells, cells quoted when they contain a comma, quote, or newline.
 */

export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = cellText(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function cellText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

export function toCsvRow(values: readonly unknown[]): string {
  return values.map(toCsvCell).join(',');
}

export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  return [toCsvRow(headers), ...rows.map(toCsvRow)].join('\r\n');
}

/** `transactions-2026-01-31.csv` — the date comes from the caller, never from a hidden clock. */
export function csvFilename(base: string, at: Date | string): string {
  const date = typeof at === 'string' ? new Date(at) : at;
  return `${base}-${date.toISOString().slice(0, 10)}.csv`;
}
