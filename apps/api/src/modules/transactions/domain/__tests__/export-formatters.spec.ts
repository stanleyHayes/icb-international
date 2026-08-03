import { describe, expect, it } from 'vitest';

import { toCsv, toJsonDocument } from '../export-formatters.js';
import type { ExportLine } from '../export-lines.js';
import { toOfx } from '../export-ofx.js';

const BOOKED = new Date('2026-01-15T10:30:00.000Z');

function line(overrides: Partial<ExportLine> = {}): ExportLine {
  return {
    transactionId: '01JTEST000000000000000001',
    valueDate: '2026-01-15',
    bookedAt: BOOKED,
    description: 'Palm Grove Supermarket',
    type: 'card_purchase',
    category: 'groceries',
    direction: 'debit',
    signedMinorUnits: -4_250,
    currency: 'USD',
    runningMinorUnits: 95_750,
    ...overrides,
  };
}

describe('toCsv', () => {
  it('emits a header row and one CRLF-terminated row per line', () => {
    const csv = toCsv([line()]);

    expect(csv).toBe(
      'Date,Description,Type,Category,Direction,Amount,Currency,Balance\r\n' +
        '2026-01-15,Palm Grove Supermarket,card_purchase,groceries,debit,-42.50,USD,957.50\r\n',
    );
  });

  it('quotes fields containing commas, quotes, or line breaks (RFC 4180)', () => {
    const csv = toCsv([line({ description: 'Dinner, "The Spot"\nwith friends' })]);

    expect(csv).toContain('"Dinner, ""The Spot""\nwith friends"');
  });

  it('renders credits as positive signed amounts', () => {
    const csv = toCsv([line({ direction: 'credit', signedMinorUnits: 250_000 })]);

    expect(csv).toContain(',credit,2500.00,USD,');
  });

  it('respects currency scale — a zero-decimal currency has no fraction', () => {
    const csv = toCsv([line({ currency: 'JPY', signedMinorUnits: -1_500, runningMinorUnits: 8_500 })]);

    expect(csv).toContain(',-1500,JPY,8500\r\n');
  });

  it('emits just the header for an empty window', () => {
    expect(toCsv([])).toBe(
      'Date,Description,Type,Category,Direction,Amount,Currency,Balance\r\n',
    );
  });
});

describe('toOfx', () => {
  const context = {
    bankId: '12-34-56',
    accountId: '0011223344',
    currency: 'USD',
    from: '2026-01-01',
    to: '2026-01-31',
    asOf: new Date('2026-02-01T00:00:00.000Z'),
    closingMinorUnits: 95_750,
    documentId: '01JEXPORT00000000000000001',
  };

  it('emits the OFX 1.02 header block', () => {
    const ofx = toOfx([], context);

    expect(ofx).toContain('OFXHEADER:100');
    expect(ofx).toContain('DATA:OFXSGML');
    expect(ofx).toContain('VERSION:102');
  });

  it('emits one STMTTRN per line with OFX dates and signed amounts', () => {
    const ofx = toOfx([line()], context);

    expect(ofx).toContain('<TRNTYPE>DEBIT</TRNTYPE>');
    expect(ofx).toContain('<DTPOSTED>20260115</DTPOSTED>');
    expect(ofx).toContain('<TRNAMT>-42.50</TRNAMT>');
    expect(ofx).toContain('<FITID>01JTEST000000000000000001</FITID>');
    expect(ofx).toContain('<NAME>Palm Grove Supermarket</NAME>');
  });

  it('marks credits as CREDIT with a positive amount', () => {
    const ofx = toOfx([line({ direction: 'credit', signedMinorUnits: 10_000 })], context);

    expect(ofx).toContain('<TRNTYPE>CREDIT</TRNTYPE>');
    expect(ofx).toContain('<TRNAMT>100.00</TRNAMT>');
  });

  it('carries the account, window, and closing ledger balance', () => {
    const ofx = toOfx([line()], context);

    expect(ofx).toContain('<BANKID>12-34-56</BANKID>');
    expect(ofx).toContain('<ACCTID>0011223344</ACCTID>');
    expect(ofx).toContain('<DTSTART>20260101</DTSTART>');
    expect(ofx).toContain('<DTEND>20260131</DTEND>');
    expect(ofx).toContain('<BALAMT>957.50</BALAMT>');
    expect(ofx).toContain('<DTASOF>20260201</DTASOF>');
  });

  it('escapes SGML-significant characters in narratives', () => {
    const ofx = toOfx([line({ description: 'Kofi & Sons <Grocers>' })], context);

    expect(ofx).toContain('<NAME>Kofi &amp; Sons &lt;Grocers&gt;</NAME>');
    expect(ofx).not.toContain('Kofi & Sons');
  });
});

describe('toJsonDocument', () => {
  it('round-trips through JSON.parse with stable figures', () => {
    const parsed = JSON.parse(
      toJsonDocument([line()], {
        accountId: 'acct-1',
        from: '2026-01-01',
        to: '2026-01-31',
        generatedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ) as { transactionCount: number; transactions: { amount: string; balanceAfter: string }[] };

    expect(parsed.transactionCount).toBe(1);
    expect(parsed.transactions[0]?.amount).toBe('-42.50');
    expect(parsed.transactions[0]?.balanceAfter).toBe('957.50');
  });
});
