import { describe, expect, it } from 'vitest';

import {
  daysInMonthOf,
  isCapitalisationDate,
  isStatementDate,
  statementCycle,
  statementDateIn,
} from '../domain/capitalisation.js';

describe('statementDateIn', () => {
  it('is the statement day in an ordinary month', () => {
    expect(statementDateIn('2026-08-02', 15)).toBe('2026-08-15');
  });

  it('clamps to the last day of a short month', () => {
    expect(statementDateIn('2026-02-10', 31)).toBe('2026-02-28');
    expect(statementDateIn('2028-02-10', 31)).toBe('2028-02-29');
    expect(statementDateIn('2026-04-10', 31)).toBe('2026-04-30');
  });
});

describe('daysInMonthOf', () => {
  it('knows the Gregorian month lengths, leap years included', () => {
    expect(daysInMonthOf('2026-02-01')).toBe(28);
    expect(daysInMonthOf('2028-02-01')).toBe(29);
    expect(daysInMonthOf('2026-01-01')).toBe(31);
  });
});

describe('isStatementDate', () => {
  it('matches the account’s own day, clamped for short months', () => {
    expect(isStatementDate('2026-08-15', 15)).toBe(true);
    expect(isStatementDate('2026-08-14', 15)).toBe(false);
    expect(isStatementDate('2026-02-28', 31)).toBe(true);
    expect(isStatementDate('2026-02-27', 31)).toBe(false);
  });
});

describe('statementCycle', () => {
  it('spans from the previous statement date, exclusive, to the current, inclusive', () => {
    expect(statementCycle('2026-08-15', 15)).toEqual({
      fromExclusive: '2026-07-15',
      toInclusive: '2026-08-15',
    });
  });

  it('clamps both ends for short months', () => {
    // The current date clamps to 28 Feb; the previous cycle opened after 28 Jan.
    expect(statementCycle('2026-02-28', 31)).toEqual({
      fromExclusive: '2026-01-28',
      toInclusive: '2026-02-28',
    });
  });
});

describe('isCapitalisationDate', () => {
  it('capitalises monthly on the statement date', () => {
    expect(isCapitalisationDate('2026-08-15', 'monthly', 15)).toBe(true);
    expect(isCapitalisationDate('2026-08-16', 'monthly', 15)).toBe(false);
  });

  it('capitalises quarterly only in quarter-end months', () => {
    expect(isCapitalisationDate('2026-03-15', 'quarterly', 15)).toBe(true);
    expect(isCapitalisationDate('2026-06-15', 'quarterly', 15)).toBe(true);
    expect(isCapitalisationDate('2026-08-15', 'quarterly', 15)).toBe(false);
  });

  it('never capitalises at_maturity — the deposits lifecycle posts that interest', () => {
    expect(isCapitalisationDate('2026-08-15', 'at_maturity', 15)).toBe(false);
  });
});
