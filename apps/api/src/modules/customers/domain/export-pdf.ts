import { CONTENT_WIDTH, MARGIN } from '../../documents/domain/pdf-layout.js';
import { measureText } from '../../documents/domain/pdf-metrics.js';
import { PAGE_HEIGHT, PdfWriter, type TextStyle } from '../../documents/domain/pdf-writer.js';
import type {
  ExportFootprint,
  FootprintSection,
  FootprintTable,
} from '../infrastructure/export-footprint.js';

const TITLE_SIZE = 16;
const SECTION_SIZE = 11;
const BODY_SIZE = 9;
const LINE_HEIGHT = 13;
const ROW_HEIGHT = 13;
const SECTION_GAP = 10;
const CELL_PADDING = 4;
const ELLIPSIS = '...';
const MUTED_GREY = 0.4;

/**
 * Walking line cursor over a PdfWriter: knows when a page is full and starts the next one,
 * so every section renderer can just emit lines and never think about pagination.
 */
class Cursor {
  private y = MARGIN;

  constructor(private readonly writer: PdfWriter) {}

  line(value: string, style: TextStyle = {}, advance = LINE_HEIGHT): void {
    this.advancePastPageEnd(advance);
    this.writer.text(MARGIN, this.y, value, style);
    this.y += advance;
  }

  /** One table row: every cell on the same baseline, each clipped to its column. */
  row(cells: readonly string[], columnWidth: number, style: TextStyle = {}): void {
    this.advancePastPageEnd(ROW_HEIGHT);
    cells.forEach((cell, index) => {
      const size = style.size ?? BODY_SIZE;
      this.writer.text(
        MARGIN + index * columnWidth,
        this.y,
        fitToWidth(cell, columnWidth - CELL_PADDING, size),
        { ...style, size },
      );
    });
    this.y += ROW_HEIGHT;
  }

  gap(pixels = SECTION_GAP): void {
    this.y += pixels;
  }

  private advancePastPageEnd(needed: number): void {
    if (this.y + needed > PAGE_HEIGHT - MARGIN) {
      this.writer.newPage();
      this.y = MARGIN;
    }
  }
}

/** Clips a cell to its column so a long value cannot bleed into the next one. */
function fitToWidth(value: string, width: number, size: number): string {
  if (measureText(value, 'regular', size) <= width) {
    return value;
  }
  let clipped = value;
  while (clipped.length > 0 && measureText(`${clipped}${ELLIPSIS}`, 'regular', size) > width) {
    clipped = clipped.slice(0, -1);
  }
  return clipped.length > 0 ? `${clipped}${ELLIPSIS}` : '';
}

/**
 * Renders the footprint as a bank-branded PDF.
 *
 * The export is a document rather than a JSON payload because the bank's media boundary
 * accepts only rendered documents (PDF/images) — anything else is refused before upload, so
 * a JSON file could never reach the customer through the signed-link channel.
 */
export function renderExportPdf(footprint: ExportFootprint, bankName: string, now: Date): Buffer {
  const writer = new PdfWriter({ title: footprint.title, author: bankName, createdAt: now });
  const cursor = new Cursor(writer);

  cursor.line(bankName, { size: BODY_SIZE, grey: MUTED_GREY });
  cursor.line(footprint.title, { font: 'bold', size: TITLE_SIZE }, TITLE_SIZE + LINE_HEIGHT);
  cursor.line(`Reference ${footprint.reference} · Generated ${footprint.generatedAt}`, {
    size: BODY_SIZE,
    grey: MUTED_GREY,
  });
  cursor.gap();

  for (const section of footprint.sections) {
    renderSection(cursor, section);
  }
  for (const table of footprint.tables) {
    renderTable(cursor, table);
  }
  return writer.toBuffer();
}

function renderSection(cursor: Cursor, section: FootprintSection): void {
  if (section.rows.length === 0) {
    return;
  }
  cursor.line(section.title, { font: 'bold', size: SECTION_SIZE }, SECTION_SIZE + LINE_HEIGHT);
  for (const [label, value] of section.rows) {
    cursor.line(`${label}:  ${value}`, { size: BODY_SIZE });
  }
  cursor.gap();
}

function renderTable(cursor: Cursor, table: FootprintTable): void {
  cursor.line(table.title, { font: 'bold', size: SECTION_SIZE }, SECTION_SIZE + LINE_HEIGHT);
  if (table.rows.length === 0) {
    cursor.line('None on record', { size: BODY_SIZE, grey: MUTED_GREY });
    cursor.gap();
    return;
  }
  const columnWidth = CONTENT_WIDTH / table.header.length;
  cursor.row(table.header, columnWidth, { font: 'bold', size: BODY_SIZE });
  for (const row of table.rows) {
    cursor.row(row, columnWidth, { size: BODY_SIZE });
  }
  cursor.gap();
}
