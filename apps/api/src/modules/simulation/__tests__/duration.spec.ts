import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { previousPeriod } from '../../../simulation/eod/steps/statement-period.js';
import { parseIsoDuration } from '../domain/duration.js';

const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('parseIsoDuration', () => {
  it('reads the components the contract admits', () => {
    expect(parseIsoDuration('P1D')).toBe(DAY);
    expect(parseIsoDuration('P30D')).toBe(30 * DAY);
    expect(parseIsoDuration('PT6H')).toBe(6 * HOUR);
    expect(parseIsoDuration('PT90M')).toBe(90 * 60_000);
    expect(parseIsoDuration('PT45S')).toBe(45_000);
    expect(parseIsoDuration('P1DT12H30M')).toBe(DAY + 12 * HOUR + 30 * 60_000);
  });

  it('rejects anything that would not move the clock', () => {
    for (const invalid of ['P', 'PT', 'P0D', 'PT0S', '30D', 'P1M', 'P1Y', '']) {
      expect(() => parseIsoDuration(invalid)).toThrow(DomainError);
    }
  });
});

describe('previousPeriod', () => {
  it('covers the month that just ended', () => {
    expect(previousPeriod('2026-08-01')).toEqual({
      label: '2026-07',
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('crosses a year boundary without arithmetic on the month number', () => {
    expect(previousPeriod('2026-01-01')).toEqual({
      label: '2025-12',
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('gets February right in a leap year', () => {
    expect(previousPeriod('2028-03-01')).toEqual({
      label: '2028-02',
      from: '2028-02-01',
      to: '2028-02-29',
    });
  });
});
