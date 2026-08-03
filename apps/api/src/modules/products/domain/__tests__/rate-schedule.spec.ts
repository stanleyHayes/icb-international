import { describe, expect, it } from 'vitest';

import { ConflictError, ValidationError } from '../../../../common/errors/index.js';
import {
  insertRateChange,
  lastChangeBefore,
  resolveRateAt,
  type RateChange,
} from '../rate-schedule.js';

const JAN = new Date('2026-01-01T00:00:00.000Z');
const MAR = new Date('2026-03-01T00:00:00.000Z');
const JUN = new Date('2026-06-01T00:00:00.000Z');

const change = (effectiveFrom: Date, rate: number): RateChange => ({ effectiveFrom, rate });

describe('resolveRateAt', () => {
  it('returns the latest change in force at the instant', () => {
    const schedule = [change(JAN, 3.0), change(MAR, 3.5), change(JUN, 4.0)];
    expect(resolveRateAt(schedule, new Date('2026-04-15T00:00:00.000Z'))?.rate).toBe(3.5);
  });

  it('treats an entry effective exactly at the instant as in force', () => {
    const schedule = [change(JAN, 3.0), change(MAR, 3.5)];
    expect(resolveRateAt(schedule, MAR)?.rate).toBe(3.5);
  });

  it('returns null when every change is still in the future', () => {
    const schedule = [change(JUN, 4.0)];
    expect(resolveRateAt(schedule, MAR)).toBeNull();
  });

  it('returns null for an empty schedule', () => {
    expect(resolveRateAt([], MAR)).toBeNull();
  });

  it('resolves correctly from an unordered schedule', () => {
    const schedule = [change(JUN, 4.0), change(JAN, 3.0), change(MAR, 3.5)];
    expect(resolveRateAt(schedule, new Date('2026-05-01T00:00:00.000Z'))?.rate).toBe(3.5);
  });
});

describe('lastChangeBefore', () => {
  it('returns the effective instant of the resolved change', () => {
    const schedule = [change(JAN, 3.0), change(MAR, 3.5)];
    expect(lastChangeBefore(schedule, JUN)).toEqual(MAR);
  });

  it('returns null when nothing is in force yet', () => {
    expect(lastChangeBefore([change(JUN, 4.0)], MAR)).toBeNull();
  });
});

describe('insertRateChange', () => {
  it('appends and keeps the schedule ordered by effectiveFrom', () => {
    const schedule = insertRateChange([change(JUN, 4.0)], change(JAN, 3.0));
    expect(schedule.map((entry) => entry.rate)).toEqual([3.0, 4.0]);
  });

  it('rejects a change at an instant that already has one', () => {
    expect(() => insertRateChange([change(JAN, 3.0)], change(JAN, 3.5))).toThrow(ConflictError);
  });

  it.each([-0.5, 100.5, Number.NaN])('rejects an out-of-range rate %s', (rate) => {
    expect(() => insertRateChange([], change(JAN, rate))).toThrow(ValidationError);
  });

  it.each([0, 100])('accepts the boundary rate %s', (rate) => {
    expect(insertRateChange([], change(JAN, rate))).toHaveLength(1);
  });
});
