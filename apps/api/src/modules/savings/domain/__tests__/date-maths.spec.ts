import { describe, expect, it } from 'vitest';

import { addDays, clamp, monthsUntil, toEpochDay } from '../date-maths.js';

describe('toEpochDay', () => {
  it('counts whole days since the Unix epoch', () => {
    expect(toEpochDay('1970-01-01')).toBe(0);
    expect(toEpochDay('1970-01-02')).toBe(1);
    // A fixed leap day, deliberately not "today": the previous literal was pinned to the date
    // the test was written and silently went wrong the moment the string beside it was updated.
    // 2020-02-29 also exercises leap-year handling, which neither epoch anchor does.
    expect(toEpochDay('2020-02-29')).toBe(18_321);
    expect(toEpochDay('2020-03-01')).toBe(18_322);
  });

  it('rejects anything that is not an ISO calendar date', () => {
    expect(() => toEpochDay('2026-8-4')).toThrow(RangeError);
    expect(() => toEpochDay('04/08/2026')).toThrow(RangeError);
    expect(() => toEpochDay('2026-08-04T10:00:00Z')).toThrow(RangeError);
    expect(() => addDays('not-a-date', 1)).toThrow(RangeError);
  });
});

describe('addDays', () => {
  it('shifts a date across month and year boundaries', () => {
    expect(addDays('2026-08-04', 0)).toBe('2026-08-04');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('moves backwards for negative counts', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
});

describe('monthsUntil', () => {
  it('never reports fewer than one month, even when the target has passed', () => {
    expect(monthsUntil('2026-08-04', '2026-08-04')).toBe(1);
    expect(monthsUntil('2026-08-04', '2026-01-01')).toBe(1);
  });

  it('rounds a partial month up so the customer is not left short', () => {
    expect(monthsUntil('2026-08-04', '2026-09-03')).toBe(1);
    expect(monthsUntil('2026-08-04', '2026-09-13')).toBe(2);
    expect(monthsUntil('2026-08-04', '2027-08-04')).toBe(12);
  });
});

describe('clamp', () => {
  it('returns the bound the value crosses and the value itself inside the range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});
