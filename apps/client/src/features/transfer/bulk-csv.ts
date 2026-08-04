import { BULK_CSV_HEADERS, BULK_ROW_LIMIT } from './transfer.constants';

export interface ParsedBulkRow {
  rowNumber: number;
  accountHolderName: string;
  sortCode: string;
  accountNumber: string;
  /** `null` when the amount cell could not be parsed — the row is then invalid. */
  amountMinorUnits: number | null;
  reference: string;
  /** Human-readable reason the row cannot be submitted, if any. */
  error: string | null;
}

/** Split one CSV line, honouring double-quoted cells. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Decimal string to integer minor units via digit manipulation only — never a float (N3). */
export function decimalToMinorUnits(text: string, scale: number): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const [whole = '0', fraction = ''] = text.split('.');
  const minorUnits = Number(`${whole}${fraction.padEnd(scale, '0')}`);
  return Number.isSafeInteger(minorUnits) && minorUnits > 0 ? minorUnits : null;
}

interface RowFields {
  accountHolderName: string;
  sortCode: string;
  accountNumber: string;
  amountMinorUnits: number | null;
}

/** First failing rule wins; rules are listed in the order a user would fix them. */
function rowError(fields: RowFields): string | null {
  const checks: ReadonlyArray<readonly [boolean, string]> = [
    [
      fields.accountHolderName.length === 0 || fields.accountHolderName.length > 140,
      'Missing account holder name',
    ],
    [!/^\d{2}-\d{2}-\d{2}$/.test(fields.sortCode), 'Sort code must be 00-00-00'],
    [!/^\d{6,20}$/.test(fields.accountNumber), 'Account number must be 6–20 digits'],
    [fields.amountMinorUnits === null, 'Amount must be a positive number like 250.00'],
  ];
  const failed = checks.find(([isInvalid]) => isInvalid);
  return failed ? failed[1] : null;
}

function validateRow(cells: string[], rowNumber: number, scale: number): ParsedBulkRow {
  const [accountHolderName = '', sortCode = '', accountNumber = '', amount = '', reference = ''] =
    cells;
  const amountMinorUnits = decimalToMinorUnits(amount, scale);
  const error = rowError({ accountHolderName, sortCode, accountNumber, amountMinorUnits });

  return { rowNumber, accountHolderName, sortCode, accountNumber, amountMinorUnits, reference, error };
}

/**
 * Parse and validate a bulk-payment CSV.
 *
 * Expected columns (header row required): `account_holder_name, sort_code, account_number,
 * amount, reference`. Every row is validated here so the customer fixes the file before any
 * money instruction reaches the API — the API re-validates the batch regardless.
 */
export function parseBulkCsv(text: string, scale: number): {
  rows: ParsedBulkRow[];
  fileError: string | null;
} {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], fileError: 'The file has no payment rows.' };
  }

  const header = splitCsvLine(lines[0]!).map((cell) => cell.toLowerCase());
  const missing = BULK_CSV_HEADERS.filter((expected) => !header.includes(expected));
  if (missing.length > 0) {
    return {
      rows: [],
      fileError: `Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}. Expected ${BULK_CSV_HEADERS.join(', ')}.`,
    };
  }

  const dataLines = lines.slice(1);
  if (dataLines.length > BULK_ROW_LIMIT) {
    return { rows: [], fileError: `A batch is limited to ${BULK_ROW_LIMIT} rows; this file has ${dataLines.length}.` };
  }

  return {
    rows: dataLines.map((line, index) => validateRow(splitCsvLine(line), index + 1, scale)),
    fileError: null,
  };
}
