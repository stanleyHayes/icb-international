import { describe, expect, it } from 'vitest';

import { BRANDING, NOW } from '../../__tests__/fixtures.js';
import type { StatementFigures } from '../statement-figures.js';
import { renderStatementPdf, type StatementPdfInput } from '../statement-pdf.js';
import type { StatementLine } from '../statement-period.js';

const FIGURES: StatementFigures = {
  openingMinorUnits: 500_000,
  closingMinorUnits: 515_000,
  totalCreditsMinorUnits: 20_000,
  totalDebitsMinorUnits: 5_000,
  transactionCount: 2,
};

function line(overrides: Partial<StatementLine> = {}): StatementLine {
  return {
    valueDate: '2026-07-03',
    description: 'Salary',
    direction: 'credit',
    minorUnits: 20_000,
    balanceMinorUnits: 520_000,
    ...overrides,
  };
}

function input(overrides: Partial<StatementPdfInput> = {}): StatementPdfInput {
  return {
    branding: BRANDING,
    accountLabel: 'Everyday Current ····4321',
    identifiers: {
      number: '1234564321',
      iban: 'GH11ICBK12345678904321',
      bic: 'ICBKGHAC',
      sortCode: '12-34-56',
    },
    holderName: 'Ama Mensah',
    period: { from: '2026-07-01', to: '2026-07-31', period: '2026-07' },
    currency: 'GBP',
    figures: FIGURES,
    lines: [line()],
    generatedAt: NOW,
    ...overrides,
  };
}

function latin1(buffer: Buffer): string {
  return buffer.toString('latin1');
}

describe('renderStatementPdf', () => {
  it('renders a period with no transactions as an explicit empty table', () => {
    const pdf = renderStatementPdf(input({ lines: [] }));
    const text = latin1(pdf);

    expect(latin1(pdf.subarray(0, 8))).toBe('%PDF-1.4');
    expect(text).toContain('No transactions were posted in this period.');
    expect(text).toContain('/Count 1');
  });

  it('starts a continuation page when the table overruns the body', () => {
    const lines = Array.from({ length: 60 }, (_, index) =>
      line({ description: `Entry ${String(index)}`, direction: index % 2 === 0 ? 'credit' : 'debit' }),
    );

    const pdf = renderStatementPdf(input({ lines }));
    const text = latin1(pdf);

    expect(text).toMatch(/\/Count [2-9]/);
    // PDF literal strings escape parentheses on the way into the content stream.
    expect(text).toContain('\\(continued\\)');
    expect(text).toContain('Page 2');
  });
});
