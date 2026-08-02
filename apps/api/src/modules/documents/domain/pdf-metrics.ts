/**
 * Helvetica advance widths, taken from the Adobe Font Metrics for the two faces the bank's
 * documents use. Values are per 1000 units of type size, for character codes 32–126.
 *
 * These exist so the writer can right-align an amount column and truncate a long narrative
 * without guessing. A PDF viewer positions glyphs from these same metrics, so measuring with
 * anything else would put the decimal points visibly out of line.
 */
const HELVETICA: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const HELVETICA_BOLD: readonly number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

export type PdfFont = 'regular' | 'bold';

const FIRST_CODE = 32;
const LAST_CODE = 126;
/** Width used for anything outside the measured range; the mean of the lower-case letters. */
const FALLBACK_WIDTH = 500;
const UNITS_PER_EM = 1000;
const ELLIPSIS = '...';

function widthOf(code: number, table: readonly number[]): number {
  if (code < FIRST_CODE || code > LAST_CODE) {
    return FALLBACK_WIDTH;
  }
  return table[code - FIRST_CODE] ?? FALLBACK_WIDTH;
}

/** Rendered width of `text` in points, at `size` points of type. */
export function measureText(text: string, font: PdfFont, size: number): number {
  const table = font === 'bold' ? HELVETICA_BOLD : HELVETICA;
  let total = 0;
  for (let index = 0; index < text.length; index += 1) {
    total += widthOf(text.charCodeAt(index), table);
  }
  return (total * size) / UNITS_PER_EM;
}

/**
 * Clips text to `maxWidth`, ending in an ellipsis. A merchant name that overran its column
 * would collide with the amount beside it, which on a bank statement reads as a wrong figure.
 */
export function truncateToWidth(
  text: string,
  font: PdfFont,
  size: number,
  maxWidth: number,
): string {
  if (measureText(text, font, size) <= maxWidth) {
    return text;
  }
  let clipped = text;
  while (clipped.length > 0 && measureText(clipped + ELLIPSIS, font, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return clipped + ELLIPSIS;
}

/**
 * Greedy word wrap. The writer draws one line of text per call, so prose in a letter has to be
 * broken here — and it is broken on measured widths, not on a character count, because a line
 * of narrow letters fits far more than a line of capitals.
 */
export function wrapText(
  text: string,
  font: PdfFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(/\s+/).filter((part) => part.length > 0)) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (measureText(candidate, font, size) <= maxWidth || current.length === 0) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}
