import { describe, expect, it } from 'vitest';

import { measureText, truncateToWidth, wrapText } from '../pdf-metrics.js';

describe('measureText', () => {
  it('measures the regular face from the Helvetica table', () => {
    expect(measureText('m', 'regular', 10)).toBeCloseTo(8.33, 5);
  });

  it('measures the bold face from its own table', () => {
    expect(measureText('A', 'regular', 10)).toBeCloseTo(6.67, 5);
    expect(measureText('A', 'bold', 10)).toBeCloseTo(7.22, 5);
  });

  it('scales linearly with the type size', () => {
    expect(measureText('m', 'regular', 20)).toBeCloseTo(measureText('m', 'regular', 10) * 2, 5);
  });

  it('uses the fallback width for characters below the measured range', () => {
    expect(measureText('\n', 'regular', 10)).toBeCloseTo(5, 5);
  });

  it('uses the fallback width for characters above the measured range', () => {
    expect(measureText('é', 'regular', 10)).toBeCloseTo(5, 5);
  });

  it('measures an empty string as zero width', () => {
    expect(measureText('', 'regular', 10)).toBe(0);
  });
});

describe('truncateToWidth', () => {
  it('returns text that already fits unchanged', () => {
    expect(truncateToWidth('Rent', 'regular', 9, 175)).toBe('Rent');
  });

  it('clips an over-long narrative to the column and ends it in an ellipsis', () => {
    const long = 'Supercalifragilistic merchant acquiring services limited';

    const clipped = truncateToWidth(long, 'regular', 9, 175);

    expect(clipped.endsWith('...')).toBe(true);
    expect(clipped.length).toBeLessThan(long.length);
    expect(measureText(clipped, 'regular', 9)).toBeLessThanOrEqual(175);
  });

  it('collapses to a bare ellipsis when even that cannot fit', () => {
    expect(truncateToWidth('Anything at all', 'regular', 9, 1)).toBe('...');
  });
});

describe('wrapText', () => {
  it('wraps prose greedily on measured widths', () => {
    const text = 'The quick brown fox jumps over the lazy dog again and again';
    const maxWidth = 120;

    const lines = wrapText(text, 'regular', 10, maxWidth);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(measureText(line, 'regular', 10)).toBeLessThanOrEqual(maxWidth);
    }
    expect(lines.join(' ')).toBe(text);
  });

  it('keeps a single word that is wider than the line on its own line', () => {
    const word = 'supercalifragilisticexpialidocious';

    const lines = wrapText(word, 'regular', 10, 50);

    expect(lines).toEqual([word]);
  });

  it('returns no lines for empty or whitespace-only input', () => {
    expect(wrapText('', 'regular', 10, 100)).toEqual([]);
    expect(wrapText('   \t  ', 'regular', 10, 100)).toEqual([]);
  });

  it('collapses runs of whitespace between words', () => {
    expect(wrapText('alpha    beta', 'regular', 10, 500)).toEqual(['alpha beta']);
  });
});
