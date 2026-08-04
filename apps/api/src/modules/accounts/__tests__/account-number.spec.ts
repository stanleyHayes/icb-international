import { describe, expect, it } from 'vitest';

import {
  formatIban,
  generateAccountNumber,
  generateIban,
  isValidAccountNumber,
  isValidIban,
  luhnCheckDigit,
} from '../domain/account-number.js';

describe('generateAccountNumber', () => {
  it('builds ten digits with a valid Luhn check digit from injected entropy', () => {
    let tick = 0;
    const entropy = () => {
      tick = (tick + 1) % 10;
      return tick / 10; // deterministic digits 1,2,3,…
    };

    const number = generateAccountNumber(entropy);

    expect(number).toMatch(/^\d{10}$/);
    expect(isValidAccountNumber(number)).toBe(true);
  });

  it('is reproducible for the same entropy source (seeded data stays stable)', () => {
    const fixed = () => 0.42;

    expect(generateAccountNumber(fixed)).toBe(generateAccountNumber(fixed));
  });
});

describe('luhnCheckDigit', () => {
  it('computes the digit that makes the body Luhn-valid', () => {
    expect(luhnCheckDigit('7992739871')).toBe('3'); // canonical Luhn example
  });
});

describe('isValidAccountNumber', () => {
  it('rejects malformed numbers', () => {
    expect(isValidAccountNumber('123')).toBe(false);
    expect(isValidAccountNumber('abcdefghij')).toBe(false);
    expect(isValidAccountNumber('79927398710')).toBe(false); // 11 digits
  });

  it('accepts only numbers whose check digit matches', () => {
    const valid = generateAccountNumber(() => 0.42);
    const tampered = `${valid.slice(0, -1)}${valid.endsWith('0') ? '1' : '0'}`;

    expect(isValidAccountNumber(valid)).toBe(true);
    expect(isValidAccountNumber(tampered)).toBe(false);
  });
});

describe('generateIban / isValidIban', () => {
  it('produces a MOD-97 valid IBAN', () => {
    const iban = generateIban('GH', 'ICBK', '6016133192');

    expect(iban.startsWith('GH')).toBe(true);
    expect(isValidIban(iban)).toBe(true);
  });

  it('upper-cases the country and bank codes', () => {
    const iban = generateIban('gh', 'icbk', '6016133192');

    expect(iban).toBe(generateIban('GH', 'ICBK', '6016133192'));
  });

  it('rejects tampered and malformed IBANs', () => {
    const iban = generateIban('GH', 'ICBK', '6016133192');
    const tampered = `${iban.slice(0, -1)}${iban.endsWith('0') ? '1' : '0'}`;

    expect(isValidIban(tampered)).toBe(false);
    expect(isValidIban('GH29ICBK')).toBe(false); // too short
    expect(isValidIban('')).toBe(false);
  });

  it('accepts IBANs with display spacing and lower case', () => {
    const iban = generateIban('GH', 'ICBK', '6016133192');

    expect(isValidIban(formatIban(iban).toLowerCase())).toBe(true);
  });
});

describe('formatIban', () => {
  it('groups into fours for display', () => {
    expect(formatIban('GH29ICBK60161331926819')).toBe('GH29 ICBK 6016 1331 9268 19');
  });
});
