import { describe, expect, it } from 'vitest';

import { InvalidScheduleError } from '../transfer-errors.js';
import { nextOccurrence, occurrenceAt, parseRRule } from '../rrule.js';

const NOW = new Date('2026-08-02T12:00:00.000Z'); // Sunday

describe('parseRRule', () => {
  it('parses a weekly rule with interval and count', () => {
    expect(parseRRule('FREQ=WEEKLY;INTERVAL=2;COUNT=10')).toEqual({
      freq: 'WEEKLY',
      interval: 2,
      count: 10,
      until: null,
    });
  });

  it('defaults the interval to 1 and parses UNTIL', () => {
    const rule = parseRRule('FREQ=MONTHLY;UNTIL=20261231');
    expect(rule.interval).toBe(1);
    expect(rule.until?.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('rejects an unsupported frequency', () => {
    expect(() => parseRRule('FREQ=HOURLY')).toThrow(InvalidScheduleError);
    expect(() => parseRRule('INTERVAL=two')).toThrow(InvalidScheduleError);
    expect(() => parseRRule('FREQ=DAILY;COUNT=0')).toThrow(InvalidScheduleError);
  });
});

describe('occurrenceAt', () => {
  it('steps daily, weekly and monthly from the anchor', () => {
    const daily = parseRRule('FREQ=DAILY;INTERVAL=3');
    expect(occurrenceAt(daily, '2026-08-01', 2).toISOString().slice(0, 10)).toBe('2026-08-07');

    const weekly = parseRRule('FREQ=WEEKLY');
    expect(occurrenceAt(weekly, '2026-08-01', 3).toISOString().slice(0, 10)).toBe('2026-08-22');

    const monthly = parseRRule('FREQ=MONTHLY');
    expect(occurrenceAt(monthly, '2026-01-31', 1).toISOString().slice(0, 10)).toBe('2026-02-28');
  });
});

describe('nextOccurrence', () => {
  it('returns the first occurrence strictly after now', () => {
    const rule = parseRRule('FREQ=DAILY');
    const next = nextOccurrence(rule, { startsOn: '2026-08-01' }, NOW);
    expect(next?.toISOString()).toBe('2026-08-03T00:00:00.000Z');
  });

  it('starts on the anchor when it is still ahead', () => {
    const rule = parseRRule('FREQ=WEEKLY');
    const next = nextOccurrence(rule, { startsOn: '2026-08-10' }, NOW);
    expect(next?.toISOString().slice(0, 10)).toBe('2026-08-10');
  });

  it('stops at COUNT', () => {
    const rule = parseRRule('FREQ=DAILY;COUNT=2');
    expect(nextOccurrence(rule, { startsOn: '2026-08-01' }, NOW)).toBeNull();
  });

  it('stops at the schedule endsOn, inclusive of the end date', () => {
    const rule = parseRRule('FREQ=DAILY');
    const schedule = { startsOn: '2026-08-01', endsOn: '2026-08-03' };
    expect(nextOccurrence(rule, schedule, NOW)?.toISOString().slice(0, 10)).toBe('2026-08-03');
    expect(nextOccurrence(rule, schedule, new Date('2026-08-03T00:00:00.000Z'))).toBeNull();
  });

  it('stops at maxOccurrences', () => {
    const rule = parseRRule('FREQ=MONTHLY');
    const schedule = { startsOn: '2026-08-01', maxOccurrences: 2 };
    const first = nextOccurrence(rule, schedule, NOW);
    expect(first?.toISOString().slice(0, 10)).toBe('2026-09-01');
    const second = nextOccurrence(rule, schedule, first as Date);
    expect(second).toBeNull();
  });

  it('stops at UNTIL', () => {
    const rule = parseRRule('FREQ=DAILY;UNTIL=20260802');
    expect(nextOccurrence(rule, { startsOn: '2026-08-01' }, NOW)).toBeNull();
  });
});
