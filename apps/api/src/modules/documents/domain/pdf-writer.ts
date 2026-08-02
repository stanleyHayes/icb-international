import { measureText, type PdfFont } from './pdf-metrics.js';

/**
 * A minimal PDF 1.4 writer.
 *
 * The bank renders its own statements rather than taking a rendering dependency, so this file
 * emits the byte stream itself: a catalog, a page tree, one uncompressed content stream per
 * page, the two standard Helvetica faces (no embedding required — every reader has them), a
 * cross-reference table with real byte offsets, and a trailer. The result opens in Preview,
 * Acrobat, Chrome and pdftotext.
 *
 * Callers work in a top-left origin measured in points; the writer flips to PDF's bottom-left
 * origin on the way out, because thinking upside-down while laying out a table is how columns
 * end up misaligned.
 */

/** A4 in points. */
export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

export type TextAlign = 'left' | 'right' | 'center';

export interface TextStyle {
  font?: PdfFont;
  size?: number;
  align?: TextAlign;
  /** Fill grey: 0 is black, 1 is white. */
  grey?: number;
}

const FONT_RESOURCE: Readonly<Record<PdfFont, string>> = { regular: '/F1', bold: '/F2' };
const DEFAULT_SIZE = 10;
const PDF_HEADER = '%PDF-1.4\n';
/** A binary comment, so tools that sniff the first bytes treat the file as binary. */
const BINARY_MARKER = Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);
const FREE_XREF_ENTRY = '0000000000 65535 f \n';
const OBJECT_NUMBER_WIDTH = 10;

function latin1(value: string): Buffer {
  return Buffer.from(value, 'latin1');
}

function fmt(value: number): string {
  return value.toFixed(2);
}

/**
 * WinAnsiEncoding covers Latin-1; anything above it has no code point in the font, so it is
 * folded to a question mark rather than silently emitting a byte that renders as garbage.
 */
function sanitise(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    out += code >= 32 && code <= 255 ? value[index] : '?';
  }
  return out;
}

/** Backslash, and both parentheses, terminate a PDF literal string unless escaped. */
function escapeLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function alignedX(x: number, width: number, align: TextAlign): number {
  if (align === 'right') {
    return x - width;
  }
  return align === 'center' ? x - width / 2 : x;
}

/** `D:20260802143000+00'00'` — the format §7.9.4 requires. */
function pdfDate(instant: Date): string {
  const iso = instant.toISOString();
  const digits = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`;
  return `D:${digits}${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}+00'00'`;
}

export interface PdfMetadata {
  title: string;
  author: string;
  createdAt: Date;
}

export class PdfWriter {
  private readonly completed: string[] = [];
  private operators: string[] = [];

  constructor(private readonly metadata: PdfMetadata) {}

  /** Draws a single line of text. `y` is the baseline, measured down from the page top. */
  text(x: number, y: number, value: string, style: TextStyle = {}): void {
    const font = style.font ?? 'regular';
    const size = style.size ?? DEFAULT_SIZE;
    const content = sanitise(value);
    const originX = alignedX(x, measureText(content, font, size), style.align ?? 'left');

    this.operators.push(
      [
        'BT',
        `${FONT_RESOURCE[font]} ${fmt(size)} Tf`,
        `${fmt(style.grey ?? 0)} g`,
        `1 0 0 1 ${fmt(originX)} ${fmt(PAGE_HEIGHT - y)} Tm`,
        `(${escapeLiteral(content)}) Tj`,
        'ET',
      ].join(' '),
    );
  }

  /** A horizontal or diagonal rule. */
  line(x1: number, y1: number, x2: number, y2: number, grey = 0.8, width = 0.5): void {
    this.operators.push(
      `${fmt(width)} w ${fmt(grey)} G ${fmt(x1)} ${fmt(PAGE_HEIGHT - y1)} m ` +
        `${fmt(x2)} ${fmt(PAGE_HEIGHT - y2)} l S`,
    );
  }

  /** A filled rectangle, used for table header bands and the summary block. */
  rect(x: number, y: number, width: number, height: number, grey: number): void {
    this.operators.push(
      `${fmt(grey)} g ${fmt(x)} ${fmt(PAGE_HEIGHT - y - height)} ${fmt(width)} ${fmt(height)} re f`,
    );
  }

  /** Closes the current page and starts a new one. */
  newPage(): void {
    this.completed.push(this.operators.join('\n'));
    this.operators = [];
  }

  get pageCount(): number {
    return this.completed.length + 1;
  }

  toBuffer(): Buffer {
    const streams = [...this.completed, this.operators.join('\n')];
    const firstPage = 3;
    const firstContent = firstPage + streams.length;
    const fontRegular = firstContent + streams.length;
    const infoNumber = fontRegular + 2;

    const bodies: Buffer[] = [
      latin1('<< /Type /Catalog /Pages 2 0 R >>'),
      latin1(this.pagesObject(firstPage, streams.length)),
      ...streams.map((_, index) =>
        latin1(this.pageObject(firstContent + index, fontRegular)),
      ),
      ...streams.map((stream) => contentObject(stream)),
      latin1(fontObject('Helvetica')),
      latin1(fontObject('Helvetica-Bold')),
      latin1(this.infoObject()),
    ];

    return assemble(bodies, infoNumber);
  }

  private pagesObject(firstPage: number, count: number): string {
    const kids = Array.from({ length: count }, (_, index) => `${firstPage + index} 0 R`).join(' ');
    return `<< /Type /Pages /Kids [${kids}] /Count ${String(count)} >>`;
  }

  private pageObject(contentNumber: number, fontRegular: number): string {
    return (
      `<< /Type /Page /Parent 2 0 R ` +
      `/MediaBox [0 0 ${fmt(PAGE_WIDTH)} ${fmt(PAGE_HEIGHT)}] ` +
      `/Resources << /ProcSet [/PDF /Text] /Font << /F1 ${String(fontRegular)} 0 R ` +
      `/F2 ${String(fontRegular + 1)} 0 R >> >> /Contents ${String(contentNumber)} 0 R >>`
    );
  }

  private infoObject(): string {
    const { title, author, createdAt } = this.metadata;
    return (
      `<< /Title (${escapeLiteral(sanitise(title))}) ` +
      `/Author (${escapeLiteral(sanitise(author))}) ` +
      `/Creator (ICB Core Banking) /Producer (ICB Core Banking) ` +
      `/CreationDate (${pdfDate(createdAt)}) >>`
    );
  }
}

function fontObject(baseFont: string): string {
  return `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} /Encoding /WinAnsiEncoding >>`;
}

function contentObject(stream: string): Buffer {
  const body = latin1(stream);
  return Buffer.concat([
    latin1(`<< /Length ${String(body.length)} >>\nstream\n`),
    body,
    latin1('\nendstream'),
  ]);
}

/**
 * Lays the objects out and records where each one starts. The cross-reference table is a byte
 * index, so the offsets must be measured on the buffer that is actually written — which is why
 * every object is materialised before any of them is numbered.
 */
function assemble(bodies: readonly Buffer[], infoNumber: number): Buffer {
  const chunks: Buffer[] = [latin1(PDF_HEADER), BINARY_MARKER];
  const offsets: number[] = [];
  let cursor = PDF_HEADER.length + BINARY_MARKER.length;

  bodies.forEach((body, index) => {
    const chunk = Buffer.concat([
      latin1(`${String(index + 1)} 0 obj\n`),
      body,
      latin1('\nendobj\n'),
    ]);
    offsets.push(cursor);
    cursor += chunk.length;
    chunks.push(chunk);
  });

  chunks.push(latin1(buildXref(offsets)));
  chunks.push(
    latin1(
      `trailer\n<< /Size ${String(bodies.length + 1)} /Root 1 0 R ` +
        `/Info ${String(infoNumber)} 0 R >>\nstartxref\n${String(cursor)}\n%%EOF\n`,
    ),
  );

  return Buffer.concat(chunks);
}

function buildXref(offsets: readonly number[]): string {
  const rows = offsets
    .map((offset) => `${offset.toString().padStart(OBJECT_NUMBER_WIDTH, '0')} 00000 n \n`)
    .join('');
  return `xref\n0 ${String(offsets.length + 1)}\n${FREE_XREF_ENTRY}${rows}`;
}
