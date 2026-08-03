import { toDecimalString } from '@icb/money';

import type { ExportLine } from './export-lines.js';

/**
 * CSV and JSON export renderers. Pure: lines in, string out, no clock, no I/O — which is what
 * makes the byte-level shape unit-testable. Amounts are signed decimals in the account's own
 * scale via `@icb/money`; minor units never leak into a customer document.
 */

const CSV_HEADER = 'Date,Description,Type,Category,Direction,Amount,Currency,Balance';
const CRLF = '\r\n';

/** RFC 4180: quote when the value contains a comma, quote, or line break; double inner quotes. */
function csvField(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function decimal(signedMinorUnits: number, currency: ExportLine['currency']): string {
  return toDecimalString({ minorUnits: signedMinorUnits, currency });
}

function csvRow(line: ExportLine): string {
  return [
    line.valueDate,
    csvField(line.description),
    line.type,
    line.category,
    line.direction,
    decimal(line.signedMinorUnits, line.currency),
    line.currency,
    decimal(line.runningMinorUnits, line.currency),
  ].join(',');
}

/** One header row plus one row per line, CRLF-terminated per RFC 4180. */
export function toCsv(lines: readonly ExportLine[]): string {
  const rows = lines.map(csvRow);
  return [CSV_HEADER, ...rows].join(CRLF) + CRLF;
}

/** Context the JSON document carries so the file is self-describing once detached. */
export interface JsonExportContext {
  readonly accountId: string;
  readonly from: string;
  readonly to: string;
  readonly generatedAt: Date;
}

/** A faithful JSON rendering of the same lines, for customers scripting against their data. */
export function toJsonDocument(lines: readonly ExportLine[], context: JsonExportContext): string {
  const document = {
    accountId: context.accountId,
    from: context.from,
    to: context.to,
    generatedAt: context.generatedAt.toISOString(),
    transactionCount: lines.length,
    transactions: lines.map((line) => ({
      id: line.transactionId,
      valueDate: line.valueDate,
      bookedAt: line.bookedAt.toISOString(),
      description: line.description,
      type: line.type,
      category: line.category,
      direction: line.direction,
      amount: decimal(line.signedMinorUnits, line.currency),
      currency: line.currency,
      balanceAfter: decimal(line.runningMinorUnits, line.currency),
    })),
  };

  return `${JSON.stringify(document, null, 2)}\n`;
}
