import { PAGE_HEIGHT, PAGE_WIDTH, type PdfWriter } from './pdf-writer.js';

/** Institution details printed on every document the bank issues. */
export interface DocumentBranding {
  bankName: string;
  bic: string;
  sortCode: string;
  country: string;
}

export const MARGIN = 48;
export const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
export const CONTENT_WIDTH = CONTENT_RIGHT - MARGIN;
/** Nothing is drawn below this line; the footer lives underneath it. */
export const BODY_BOTTOM = PAGE_HEIGHT - 72;

export const TITLE_SIZE = 20;
export const HEADING_SIZE = 11;
export const BODY_SIZE = 9.5;
export const SMALL_SIZE = 8;

const RULE_GREY = 0.75;
const MUTED_GREY = 0.42;
const BAND_GREY = 0.93;

/** Key/value pairs rendered as a two-column block. */
export interface DetailRow {
  label: string;
  value: string;
}

/**
 * The letterhead: bank name, document title, and the regulatory identifiers a reader needs to
 * confirm the document came from this institution.
 *
 * Returns the y of the first free line, so callers never hard-code where their body starts.
 */
export function drawLetterhead(
  pdf: PdfWriter,
  branding: DocumentBranding,
  title: string,
  subtitle: string,
): number {
  pdf.text(MARGIN, 60, branding.bankName, { font: 'bold', size: TITLE_SIZE });
  pdf.text(CONTENT_RIGHT, 52, `BIC ${branding.bic}`, {
    align: 'right',
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });
  pdf.text(CONTENT_RIGHT, 64, `Sort code ${branding.sortCode}`, {
    align: 'right',
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });
  pdf.text(CONTENT_RIGHT, 76, `Registered in ${branding.country}`, {
    align: 'right',
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });

  pdf.line(MARGIN, 84, CONTENT_RIGHT, 84, RULE_GREY, 1);
  pdf.text(MARGIN, 112, title, { font: 'bold', size: 14 });
  pdf.text(MARGIN, 128, subtitle, { size: BODY_SIZE, grey: MUTED_GREY });

  return 156;
}

/** A compact heading used when a table spills onto a second or third page. */
export function drawContinuation(pdf: PdfWriter, branding: DocumentBranding, title: string): number {
  pdf.text(MARGIN, 56, branding.bankName, { font: 'bold', size: HEADING_SIZE });
  pdf.text(CONTENT_RIGHT, 56, `${title} (continued)`, {
    align: 'right',
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });
  pdf.line(MARGIN, 64, CONTENT_RIGHT, 64, RULE_GREY, 0.5);
  return 88;
}

/**
 * Label-over-value detail block. Returns the y below the block.
 *
 * The row pitch has to clear a caption *and* a value: at anything tighter the next caption
 * lands inside the ascenders of the value above it, which reads as two fields run together.
 */
const DETAIL_ROW_HEIGHT = 28;
const DETAIL_VALUE_OFFSET = 12;

export function drawDetails(
  pdf: PdfWriter,
  x: number,
  top: number,
  rows: readonly DetailRow[],
): number {
  rows.forEach((row, index) => {
    const y = top + index * DETAIL_ROW_HEIGHT;
    pdf.text(x, y, row.label, { size: SMALL_SIZE, grey: MUTED_GREY });
    pdf.text(x, y + DETAIL_VALUE_OFFSET, row.value, { size: BODY_SIZE, font: 'bold' });
  });
  return top + rows.length * DETAIL_ROW_HEIGHT + 8;
}

/** A tinted band, used behind table headers and the balance summary. */
export function drawBand(pdf: PdfWriter, top: number, height: number): void {
  pdf.rect(MARGIN, top, CONTENT_WIDTH, height, BAND_GREY);
}

export function drawRule(pdf: PdfWriter, y: number): void {
  pdf.line(MARGIN, y, CONTENT_RIGHT, y, RULE_GREY, 0.5);
}

/**
 * Footer. Printed on every page so a detached sheet still identifies itself, and carries the
 * generation timestamp so two renders of the same period are distinguishable.
 */
export function drawFooter(
  pdf: PdfWriter,
  branding: DocumentBranding,
  pageNumber: number,
  generatedAtLabel: string,
): void {
  const y = PAGE_HEIGHT - 52;
  pdf.line(MARGIN, y - 14, CONTENT_RIGHT, y - 14, RULE_GREY, 0.5);
  pdf.text(MARGIN, y, `${branding.bankName} - issued ${generatedAtLabel}`, {
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });
  pdf.text(CONTENT_RIGHT, y, `Page ${String(pageNumber)}`, {
    align: 'right',
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });
  pdf.text(MARGIN, y + 12, 'This document is confidential and issued for the account holder.', {
    size: SMALL_SIZE,
    grey: MUTED_GREY,
  });
}
