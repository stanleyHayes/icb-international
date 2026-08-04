import { describe, expect, it } from 'vitest';

import { csvFilename, toCsv, toCsvCell, toCsvRow } from '../csv';

describe('toCsvCell', () => {
  it('renders null and undefined as empty cells', () => {
    expect(toCsvCell(null)).toBe('');
    expect(toCsvCell(undefined)).toBe('');
  });

  it('quotes cells containing commas, quotes, or newlines', () => {
    expect(toCsvCell('a,b')).toBe('"a,b"');
    expect(toCsvCell('she said "hi"')).toBe('"she said ""hi"""');
    expect(toCsvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('serialises objects as JSON', () => {
    expect(toCsvCell({ minorUnits: 100 })).toBe('"{""minorUnits"":100}"');
  });

  it('passes plain values through untouched', () => {
    expect(toCsvCell('plain')).toBe('plain');
    expect(toCsvCell(42)).toBe('42');
  });
});

describe('toCsv', () => {
  it('joins header and rows with CRLF', () => {
    const csv = toCsv(['Name', 'Amount'], [['Coffee', 350], ['Bagel, plain', 200]]);
    expect(csv).toBe('Name,Amount\r\nCoffee,350\r\n"Bagel, plain",200');
  });

  it('handles an empty row set', () => {
    expect(toCsv(['A'], [])).toBe('A');
  });
});

describe('toCsvRow', () => {
  it('joins cells with commas', () => {
    expect(toCsvRow([1, 'two', null])).toBe('1,two,');
  });
});

describe('csvFilename', () => {
  it('stamps the caller-provided date', () => {
    expect(csvFilename('transactions', '2026-01-31T10:00:00Z')).toBe('transactions-2026-01-31.csv');
  });
});
