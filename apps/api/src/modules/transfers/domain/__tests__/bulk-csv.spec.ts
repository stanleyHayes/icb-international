import { describe, expect, it } from 'vitest';

import { parseBulkTransferCsv } from '../bulk-csv.js';
import { BulkTransferValidationError } from '../transfer-errors.js';

const HEADER =
  'kind,accountNumber,sortCode,holderName,iban,bic,country,amount,currency,reference';

describe('parseBulkTransferCsv', () => {
  it('parses a mixed batch, preserving row numbers', () => {
    const csv = [
      HEADER,
      'domestic_bank,12345678,12-34-56,Jane Doe,,,,125.50,GBP,Invoice 7',
      'icb_customer,0011223344,,,,,,10.00,GBP,',
      'international,,,Mario Rossi,DE89370400440532013000,DEUTDEFF,DE,99.99,EUR,Rent',
    ].join('\n');

    const { rows } = parseBulkTransferCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.rowNumber).toBe(2);
    expect(rows[0]?.destination).toEqual({
      kind: 'domestic_bank',
      accountNumber: '12345678',
      sortCode: '12-34-56',
      accountHolderName: 'Jane Doe',
    });
    expect(rows[0]?.amount).toEqual({ minorUnits: 12550, currency: 'GBP', scale: 2 });
    expect(rows[1]?.reference).toBeUndefined();
    expect(rows[2]?.destination.kind).toBe('international');
  });

  it('rejects a malformed header', () => {
    expect(() => parseBulkTransferCsv('a,b,c\n1,2,3')).toThrow(BulkTransferValidationError);
  });

  it('collects row failures with their row numbers and pays nothing', () => {
    const csv = [HEADER, 'spaceship,1,2,3,,,,,10,GBP,'].join('\n');
    try {
      parseBulkTransferCsv(csv);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BulkTransferValidationError);
      const failures = (error as BulkTransferValidationError).context['failures'] as {
        rowNumber: number;
      }[];
      expect(failures[0]?.rowNumber).toBe(2);
    }
  });

  it('rejects an unknown currency', () => {
    const csv = [HEADER, 'icb_customer,0011223344,,,,,,10.00,XXX,'].join('\n');
    expect(() => parseBulkTransferCsv(csv)).toThrow(BulkTransferValidationError);
  });
});
