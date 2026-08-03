import { toDecimalString } from '@icb/money';

import { truncateToWidth } from '../../documents/domain/pdf-metrics.js';
import { PdfWriter } from '../../documents/domain/pdf-writer.js';
import type { ExportLine } from './export-lines.js';

/**
 * Transaction-export PDF. Rendered with the same in-house writer the statements use, so the
 * export looks like it came from the same bank and no rendering dependency is added. Layout
 * mirrors the statement table: date, description, money out, money in, running balance.
 */

export interface ExportPdfContext {
  readonly bankName: string;
  readonly accountLabel: string;
  readonly from: string;
  readonly to: string;
  readonly currency: ExportLine['currency'];
  readonly openingMinorUnits: number;
  readonly closingMinorUnits: number;
  readonly generatedAt: Date;
}

const MARGIN = 40;
const TITLE_Y = 56;
const META_Y = 78;
const HEADER_Y = 110;
const ROW_HEIGHT = 15;
const BODY_SIZE = 9;
const BOTTOM_LIMIT = 800;

const DATE_X = MARGIN;
const DESCRIPTION_X = 100;
const DESCRIPTION_WIDTH = 200;
const OUT_RIGHT = 380;
const IN_RIGHT = 460;
const BALANCE_RIGHT = 555;
const MUTED = 0.42;

function decimal(minorUnits: number, currency: ExportPdfContext['currency']): string {
  return toDecimalString({ minorUnits, currency });
}

function drawPageHeader(writer: PdfWriter, context: ExportPdfContext): void {
  writer.text(MARGIN, TITLE_Y, context.bankName, { font: 'bold', size: 14 });
  writer.text(MARGIN, META_Y, `Transaction export · ${context.accountLabel}`, { grey: MUTED });
  writer.text(
    MARGIN,
    META_Y + 13,
    `Period ${context.from} to ${context.to} · generated ${context.generatedAt.toISOString()}`,
    { grey: MUTED, size: 8 },
  );
  writer.rect(MARGIN, HEADER_Y, BALANCE_RIGHT - MARGIN, ROW_HEIGHT, 0.93);
  writer.text(DATE_X + 2, HEADER_Y + 11, 'Date', { font: 'bold', size: BODY_SIZE });
  writer.text(DESCRIPTION_X, HEADER_Y + 11, 'Description', { font: 'bold', size: BODY_SIZE });
  writer.text(OUT_RIGHT, HEADER_Y + 11, 'Out', { font: 'bold', size: BODY_SIZE, align: 'right' });
  writer.text(IN_RIGHT, HEADER_Y + 11, 'In', { font: 'bold', size: BODY_SIZE, align: 'right' });
  writer.text(BALANCE_RIGHT, HEADER_Y + 11, 'Balance', { font: 'bold', size: BODY_SIZE, align: 'right' });
}

function drawLine(writer: PdfWriter, line: ExportLine, y: number): void {
  writer.text(DATE_X + 2, y, line.valueDate, { size: BODY_SIZE });
  writer.text(
    DESCRIPTION_X,
    y,
    truncateToWidth(line.description, 'regular', BODY_SIZE, DESCRIPTION_WIDTH),
    { size: BODY_SIZE },
  );
  const out = line.signedMinorUnits < 0 ? decimal(-line.signedMinorUnits, line.currency) : '';
  const incoming = line.signedMinorUnits > 0 ? decimal(line.signedMinorUnits, line.currency) : '';
  writer.text(OUT_RIGHT, y, out, { size: BODY_SIZE, align: 'right' });
  writer.text(IN_RIGHT, y, incoming, { size: BODY_SIZE, align: 'right' });
  writer.text(BALANCE_RIGHT, y, decimal(line.runningMinorUnits, line.currency), {
    size: BODY_SIZE,
    align: 'right',
  });
}

/** Renders the whole export, paginating and repeating the table header on every page. */
export function renderExportPdf(lines: readonly ExportLine[], context: ExportPdfContext): Buffer {
  const writer = new PdfWriter({
    title: `Transaction export ${context.from} to ${context.to}`,
    author: context.bankName,
    createdAt: context.generatedAt,
  });

  drawPageHeader(writer, context);
  let y = HEADER_Y + ROW_HEIGHT + 13;
  writer.text(MARGIN, y, `Opening balance ${decimal(context.openingMinorUnits, context.currency)}`, {
    font: 'bold',
    size: BODY_SIZE,
  });
  writer.text(BALANCE_RIGHT, y, decimal(context.openingMinorUnits, context.currency), {
    font: 'bold',
    size: BODY_SIZE,
    align: 'right',
  });
  y += ROW_HEIGHT;

  for (const line of lines) {
    if (y > BOTTOM_LIMIT) {
      writer.newPage();
      drawPageHeader(writer, context);
      y = HEADER_Y + ROW_HEIGHT + 13;
    }
    drawLine(writer, line, y);
    y += ROW_HEIGHT;
  }

  writer.line(MARGIN, y + 4, BALANCE_RIGHT, y + 4);
  writer.text(MARGIN, y + 18, `Closing balance ${decimal(context.closingMinorUnits, context.currency)}`, {
    font: 'bold',
    size: BODY_SIZE,
  });

  return writer.toBuffer();
}
