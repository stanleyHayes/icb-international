import type { bulkTransferRowSchema } from '@icb/contracts';
import { fromDecimalString, getScale, isCurrencyCode } from '@icb/money';

import { BulkTransferValidationError } from './transfer-errors.js';

/** One parsed payment line — the contract's row shape, referenced without a redefinition. */
export type BulkCsvRow = ReturnType<typeof bulkTransferRowSchema.parse>;

/**
 * Bulk CSV parsing.
 *
 * One row per payment, header line required:
 *   `kind,accountNumber,sortCode,holderName,iban,bic,country,amount,currency,reference`
 * `kind` is `icb_customer`, `domestic_bank` or `international`; the irrelevant identifier columns
 * stay empty for the other kinds. Parsing is all-or-nothing — the batch is validated before
 * anything executes, and a malformed file must not half-pay.
 */
export interface ParsedCsv {
  readonly rows: BulkCsvRow[];
}

const EXPECTED_COLUMNS = [
  'kind',
  'accountNumber',
  'sortCode',
  'holderName',
  'iban',
  'bic',
  'country',
  'amount',
  'currency',
  'reference',
] as const;

const SUPPORTED_KINDS = ['icb_customer', 'domestic_bank', 'international'] as const;
type CsvKind = (typeof SUPPORTED_KINDS)[number];

export function parseBulkTransferCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const [header, ...body] = lines;
  assertHeader(header ?? '');

  const failures: { rowNumber: number; code: string; message: string }[] = [];
  const rows: BulkCsvRow[] = [];

  body.forEach((line, index) => {
    const rowNumber = index + 2;
    try {
      rows.push(parseLine(line, rowNumber));
    } catch (error) {
      failures.push({
        rowNumber,
        code: 'ROW_INVALID',
        message: error instanceof Error ? error.message : 'Unparseable row',
      });
    }
  });

  if (failures.length > 0) {
    throw new BulkTransferValidationError(failures);
  }
  return { rows };
}

function assertHeader(header: string): void {
  const columns = header.split(',').map((column) => column.trim());
  if (columns.join(',') !== EXPECTED_COLUMNS.join(',')) {
    throw new BulkTransferValidationError([
      { rowNumber: 1, code: 'HEADER_INVALID', message: 'Unexpected CSV header' },
    ]);
  }
}

function parseLine(line: string, rowNumber: number): BulkCsvRow {
  const cells = line.split(',').map((cell) => cell.trim());
  const record = Object.fromEntries(EXPECTED_COLUMNS.map((column, i) => [column, cells[i] ?? '']));
  const kind = record['kind'] as CsvKind;
  if (!SUPPORTED_KINDS.includes(kind)) {
    throw new BulkTransferValidationError([
      { rowNumber, code: 'KIND_INVALID', message: `Unknown destination kind ${record['kind']}` },
    ]);
  }

  return {
    rowNumber,
    destination: destinationFor(kind, record),
    amount: parseAmount(record),
    ...(record['reference'] ? { reference: record['reference'] } : {}),
  };
}

function destinationFor(kind: CsvKind, record: Record<string, string>): BulkCsvRow['destination'] {
  switch (kind) {
    case 'icb_customer':
      return icbDestination(record);
    case 'domestic_bank':
      return domesticDestination(record);
    case 'international':
      return internationalDestination(record);
  }
}

function icbDestination(record: Record<string, string>): BulkCsvRow['destination'] {
  return { kind: 'icb_customer', accountNumber: record['accountNumber'] ?? '' };
}

function domesticDestination(record: Record<string, string>): BulkCsvRow['destination'] {
  return {
    kind: 'domestic_bank',
    accountNumber: record['accountNumber'] ?? '',
    sortCode: record['sortCode'] ?? '',
    accountHolderName: record['holderName'] ?? '',
  };
}

function internationalDestination(record: Record<string, string>): BulkCsvRow['destination'] {
  return {
    kind: 'international',
    iban: record['iban'] ?? '',
    bic: record['bic'] ?? '',
    accountHolderName: record['holderName'] ?? '',
    country: record['country'] ?? '',
  };
}

function parseAmount(record: Record<string, string>): BulkCsvRow['amount'] {
  const currency = record['currency'] ?? '';
  if (!isCurrencyCode(currency)) {
    throw new BulkTransferValidationError([
      { rowNumber: 0, code: 'CURRENCY_INVALID', message: `Unknown currency ${currency}` },
    ]);
  }
  const money = fromDecimalString(record['amount'] ?? '', currency);
  return { minorUnits: money.minorUnits, currency: money.currency, scale: getScale(money.currency) };
}
