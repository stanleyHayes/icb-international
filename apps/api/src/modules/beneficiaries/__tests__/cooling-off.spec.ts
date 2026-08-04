import { describe, expect, it } from 'vitest';

import {
  COOLING_OFF_CAP_MAJOR_UNITS,
  UNVERIFIED_CAP_MAJOR_UNITS,
  capFor,
  coolingOffEndsAt,
  isCoolingOff,
} from '../domain/cooling-off.js';

const ADDED_AT = new Date('2026-08-04T10:00:00.000Z');

describe('coolingOffEndsAt', () => {
  it('ends the window four hours after the payee was added', () => {
    expect(coolingOffEndsAt(ADDED_AT).toISOString()).toBe('2026-08-04T14:00:00.000Z');
  });

  it('does not mutate the input date', () => {
    coolingOffEndsAt(ADDED_AT);
    expect(ADDED_AT.toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });
});

describe('isCoolingOff', () => {
  const until = new Date('2026-08-04T14:00:00.000Z');

  it('is true while now is strictly before the window end', () => {
    expect(isCoolingOff(until, new Date('2026-08-04T13:59:59.999Z'))).toBe(true);
  });

  it('is false the instant the window ends', () => {
    expect(isCoolingOff(until, until)).toBe(false);
  });

  it('is false after the window has passed', () => {
    expect(isCoolingOff(until, new Date('2026-08-05T10:00:00.000Z'))).toBe(false);
  });

  it('is false when the payee carries no window at all', () => {
    expect(isCoolingOff(null, ADDED_AT)).toBe(false);
  });
});

describe('capFor', () => {
  it('expresses the cap in minor units for a two-scale currency', () => {
    expect(capFor(COOLING_OFF_CAP_MAJOR_UNITS, 'USD')).toEqual({
      minorUnits: 10_000,
      currency: 'USD',
    });
    expect(capFor(UNVERIFIED_CAP_MAJOR_UNITS, 'GBP')).toEqual({
      minorUnits: 100_000,
      currency: 'GBP',
    });
  });

  it('does not multiply a zero-scale currency by 100', () => {
    expect(capFor(COOLING_OFF_CAP_MAJOR_UNITS, 'JPY')).toEqual({
      minorUnits: 100,
      currency: 'JPY',
    });
  });

  it('uses the full factor for a three-scale currency', () => {
    expect(capFor(COOLING_OFF_CAP_MAJOR_UNITS, 'KWD')).toEqual({
      minorUnits: 100_000,
      currency: 'KWD',
    });
  });
});
