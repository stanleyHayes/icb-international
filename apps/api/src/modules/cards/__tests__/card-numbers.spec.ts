import { describe, expect, it } from 'vitest';

import {
  expiryFor,
  generateArn,
  generateCvv,
  generatePan,
  isExpired,
  isLuhnValid,
  luhnCheckDigit,
  panLast4,
} from '../domain/card-numbers.js';

const ISSUED = new Date('2026-08-04T10:00:00.000Z');

describe('generatePan', () => {
  it('issues a Luhn-valid 16-digit PAN on the network BIN', () => {
    const visa = generatePan('visa');
    const mastercard = generatePan('mastercard');

    expect(visa).toMatch(/^424212\d{10}$/);
    expect(mastercard).toMatch(/^535312\d{10}$/);
    expect(isLuhnValid(visa)).toBe(true);
    expect(isLuhnValid(mastercard)).toBe(true);
  });
});

describe('luhnCheckDigit / isLuhnValid', () => {
  it('appends the digit that makes the PAN validate', () => {
    const base = '424212345678901';

    expect(isLuhnValid(`${base}${luhnCheckDigit(base)}`)).toBe(true);
    expect(isLuhnValid(`${base}${(luhnCheckDigit(base) + 1) % 10}`)).toBe(false);
  });

  it('rejects non-numeric candidates', () => {
    expect(isLuhnValid('4242abcd')).toBe(false);
    expect(isLuhnValid('')).toBe(false);
  });
});

describe('generateCvv', () => {
  it('is three digits', () => {
    expect(generateCvv()).toMatch(/^\d{3}$/);
  });
});

describe('panLast4', () => {
  it('keeps the final four digits', () => {
    expect(panLast4('4242123456789012')).toBe('9012');
  });
});

describe('expiryFor', () => {
  it('prints the month three years after issue', () => {
    expect(expiryFor(ISSUED)).toEqual({ month: 8, year: 2029 });
  });
});

describe('isExpired', () => {
  it('is valid until the end of the printed month', () => {
    expect(isExpired(8, 2029, new Date('2029-08-31T23:59:59.000Z'))).toBe(false);
    expect(isExpired(8, 2029, new Date('2029-09-01T00:00:00.000Z'))).toBe(true);
  });
});

describe('generateArn', () => {
  it('embeds the acquirer BIN and Julian date, and passes Luhn', () => {
    // 2026-08-04 is day 216 of the year.
    const arn = generateArn(ISSUED);

    expect(arn).toMatch(/^24917036216\d{12}$/);
    expect(isLuhnValid(arn)).toBe(true);
  });
});
