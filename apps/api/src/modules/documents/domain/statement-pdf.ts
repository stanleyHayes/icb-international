import type { AccountIdentifiers } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { formatAmount, formatInstant } from './document-text.js';
import {
  BODY_BOTTOM,
  CONTENT_RIGHT,
  MARGIN,
  SMALL_SIZE,
  drawBand,
  drawContinuation,
  drawDetails,
  drawFooter,
  drawLetterhead,
  drawRule,
  type DocumentBranding,
} from './pdf-layout.js';
import { truncateToWidth } from './pdf-metrics.js';
import { PdfWriter } from './pdf-writer.js';
import type { StatementFigures } from './statement-figures.js';
import {
  formatIsoDate,
  formatPeriodLabel,
  type StatementLine,
  type StatementPeriod,
} from './statement-period.js';

export interface StatementPdfInput {
  branding: DocumentBranding;
  accountLabel: string;
  identifiers: AccountIdentifiers;
  holderName: string;
  period: StatementPeriod;
  currency: CurrencyCode;
  figures: StatementFigures;
  lines: readonly StatementLine[];
  generatedAt: Date;
}

const TITLE = 'Account statement';
const ROW_HEIGHT = 15;
const DESCRIPTION_X = 104;
/**
 * Right edges of the three numeric columns. Each is right-aligned, so the gap to the column
 * on its left is the widest amount it can hold — roughly 87pt, or eighteen digits at 9pt.
 * The description is clipped well short of the first of them so a long merchant name can
 * never print over a figure.
 */
const OUT_RIGHT = 366;
const IN_RIGHT = 456;
const DESCRIPTION_WIDTH = 175;
const BODY_SIZE = 9;
const MUTED = 0.42;

/**
 * Renders one account statement.
 *
 * The layout is deliberately conventional — letterhead, account block, balance summary, then a
 * dated table with a running balance — because a statement is read by people comparing it with
 * other banks' statements and with their own records.
 */
export function renderStatementPdf(input: StatementPdfInput): Buffer {
  const pdf = new PdfWriter({
    title: `${TITLE} ${input.period.period} - ${input.identifiers.number}`,
    author: input.branding.bankName,
    createdAt: input.generatedAt,
  });
  const issuedAt = formatInstant(input.generatedAt);

  let y = drawLetterhead(pdf, input.branding, TITLE, formatPeriodLabel(input.period));
  y = drawAccountBlock(pdf, input, y);
  y = drawSummary(pdf, input, y);
  y = drawTableHeader(pdf, input.currency, y);
  y = drawRows(pdf, input, y, issuedAt);

  drawRule(pdf, y + 2);
  pdf.text(MARGIN, y + 16, closingSentence(input), { size: BODY_SIZE, font: 'bold' });
  drawFooter(pdf, input.branding, pdf.pageCount, issuedAt);

  return pdf.toBuffer();
}

function drawAccountBlock(pdf: PdfWriter, input: StatementPdfInput, top: number): number {
  const left = drawDetails(pdf, MARGIN, top, [
    { label: 'ACCOUNT HOLDER', value: input.holderName },
    { label: 'ACCOUNT', value: input.accountLabel },
    { label: 'ACCOUNT NUMBER', value: input.identifiers.number },
  ]);
  const right = drawDetails(pdf, 320, top, [
    { label: 'IBAN', value: input.identifiers.iban },
    { label: 'SORT CODE', value: input.identifiers.sortCode },
    { label: 'CURRENCY', value: input.currency },
  ]);
  return Math.max(left, right);
}

/** The four figures the reconciliation guarantees: opening + in − out = closing. */
function drawSummary(pdf: PdfWriter, input: StatementPdfInput, top: number): number {
  const { figures, currency } = input;
  const cells: readonly { label: string; value: string }[] = [
    { label: 'OPENING BALANCE', value: formatAmount(figures.openingMinorUnits, currency) },
    { label: 'MONEY IN', value: formatAmount(figures.totalCreditsMinorUnits, currency) },
    { label: 'MONEY OUT', value: formatAmount(figures.totalDebitsMinorUnits, currency) },
    { label: 'CLOSING BALANCE', value: formatAmount(figures.closingMinorUnits, currency) },
  ];

  drawBand(pdf, top, 46);
  const columnWidth = (CONTENT_RIGHT - MARGIN) / cells.length;
  cells.forEach((cell, index) => {
    const x = MARGIN + 10 + index * columnWidth;
    pdf.text(x, top + 17, cell.label, { size: SMALL_SIZE, grey: MUTED });
    pdf.text(x, top + 34, cell.value, { size: 11, font: 'bold' });
  });

  return top + 70;
}

function drawTableHeader(pdf: PdfWriter, currency: CurrencyCode, top: number): number {
  pdf.text(MARGIN, top, 'DATE', { size: SMALL_SIZE, grey: MUTED });
  pdf.text(DESCRIPTION_X, top, 'DESCRIPTION', { size: SMALL_SIZE, grey: MUTED });
  pdf.text(OUT_RIGHT, top, `OUT (${currency})`, { size: SMALL_SIZE, grey: MUTED, align: 'right' });
  pdf.text(IN_RIGHT, top, `IN (${currency})`, { size: SMALL_SIZE, grey: MUTED, align: 'right' });
  pdf.text(CONTENT_RIGHT, top, 'BALANCE', { size: SMALL_SIZE, grey: MUTED, align: 'right' });
  drawRule(pdf, top + 6);
  return top + 21;
}

function drawRows(
  pdf: PdfWriter,
  input: StatementPdfInput,
  startY: number,
  issuedAt: string,
): number {
  if (input.lines.length === 0) {
    pdf.text(MARGIN, startY, 'No transactions were posted in this period.', {
      size: BODY_SIZE,
      grey: MUTED,
    });
    return startY + ROW_HEIGHT;
  }

  let y = startY;
  for (const line of input.lines) {
    if (y > BODY_BOTTOM) {
      drawFooter(pdf, input.branding, pdf.pageCount, issuedAt);
      pdf.newPage();
      y = drawTableHeader(pdf, input.currency, drawContinuation(pdf, input.branding, TITLE));
    }
    drawRow(pdf, line, y, input.currency);
    y += ROW_HEIGHT;
  }
  return y;
}

function drawRow(pdf: PdfWriter, line: StatementLine, y: number, currency: CurrencyCode): void {
  const amount = formatAmount(line.minorUnits, currency);
  pdf.text(MARGIN, y, formatIsoDate(line.valueDate), { size: BODY_SIZE });
  pdf.text(
    DESCRIPTION_X,
    y,
    truncateToWidth(line.description, 'regular', BODY_SIZE, DESCRIPTION_WIDTH),
    { size: BODY_SIZE },
  );
  const column = line.direction === 'debit' ? OUT_RIGHT : IN_RIGHT;
  pdf.text(column, y, amount, { size: BODY_SIZE, align: 'right' });
  pdf.text(CONTENT_RIGHT, y, formatAmount(line.balanceMinorUnits, currency), {
    size: BODY_SIZE,
    align: 'right',
  });
}

function closingSentence(input: StatementPdfInput): string {
  const closing = formatAmount(input.figures.closingMinorUnits, input.currency);
  const count = String(input.figures.transactionCount);
  return `Closing balance ${input.currency} ${closing} after ${count} transaction(s).`;
}
