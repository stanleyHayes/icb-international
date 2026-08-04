import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  compareISODates,
  isIsoDisabled,
  isSameDay,
  monthGridDays,
  parseFlexibleDate,
  parseISODate,
  toISODate,
  weekdayLabels,
} from '../date-utils';

describe('parseISODate', () => {
  it('parses strict ISO dates', () => {
    expect(toISODate(parseISODate('2026-03-04') ?? new Date(0))).toBe('2026-03-04');
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseISODate('2026-3-4')).toBeNull();
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(parseISODate('04/03/2026')).toBeNull();
    expect(parseISODate('not a date')).toBeNull();
  });
});

describe('parseFlexibleDate', () => {
  it('accepts ISO and common day-first typed forms', () => {
    expect(toISODate(parseFlexibleDate('2026-03-04') ?? new Date(0))).toBe('2026-03-04');
    expect(toISODate(parseFlexibleDate('4/3/2026') ?? new Date(0))).toBe('2026-03-04');
    expect(toISODate(parseFlexibleDate('04.03.2026') ?? new Date(0))).toBe('2026-03-04');
  });

  it('rejects nonsense', () => {
    expect(parseFlexibleDate('31/02/2026')).toBeNull();
    expect(parseFlexibleDate('')).toBeNull();
  });
});

describe('addDays / addMonths', () => {
  it('crosses month and year boundaries', () => {
    expect(toISODate(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
    expect(toISODate(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('clamps the day when the target month is shorter', () => {
    expect(toISODate(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(toISODate(addMonths(new Date(2026, 10, 30), 3))).toBe('2027-02-28');
  });
});

describe('monthGridDays', () => {
  it('always returns 42 days starting on the week start', () => {
    const grid = monthGridDays(new Date(2026, 2, 15));
    expect(grid).toHaveLength(42);
    expect(grid[0]?.getDay()).toBe(1); // Monday
  });

  it('contains every day of the month', () => {
    const grid = monthGridDays(new Date(2026, 2, 15));
    for (let day = 1; day <= 31; day += 1) {
      expect(grid.some((cell) => cell.getMonth() === 2 && cell.getDate() === day)).toBe(true);
    }
  });
});

describe('comparisons', () => {
  it('compares ISO strings chronologically', () => {
    expect(compareISODates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareISODates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareISODates('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('detects same days and disabled bounds', () => {
    expect(isSameDay(new Date(2026, 0, 1, 9), new Date(2026, 0, 1, 22))).toBe(true);
    expect(isIsoDisabled('2025-12-31', '2026-01-01')).toBe(true);
    expect(isIsoDisabled('2027-01-01', undefined, '2026-12-31')).toBe(true);
    expect(isIsoDisabled('2026-06-15', '2026-01-01', '2026-12-31')).toBe(false);
  });
});

describe('weekdayLabels', () => {
  it('starts on Monday by default and labels all seven days', () => {
    const labels = weekdayLabels('en-GB');
    expect(labels).toHaveLength(7);
    expect(labels[0]?.long).toBe('Monday');
    expect(labels[6]?.long).toBe('Sunday');
  });
});
