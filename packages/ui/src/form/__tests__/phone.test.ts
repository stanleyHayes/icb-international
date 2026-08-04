import { describe, expect, it } from 'vitest';

import {
  formatNationalNumber,
  isPossiblePhoneNumber,
  joinPhoneNumber,
  splitPhoneNumber,
} from '../phone';
import { DEFAULT_DIALING_CODES } from '../phone.constants';

describe('splitPhoneNumber', () => {
  it('splits a known calling code from the national number', () => {
    expect(splitPhoneNumber('+233555123456')).toEqual({ dialCode: '233', national: '555123456' });
    expect(splitPhoneNumber('+14155552671')).toEqual({ dialCode: '1', national: '4155552671' });
  });

  it('strips formatting before matching', () => {
    expect(splitPhoneNumber('+44 20 7946 0958')).toEqual({ dialCode: '44', national: '2079460958' });
  });

  it('falls back to the first code with all digits national when nothing matches', () => {
    const parts = splitPhoneNumber('999999', DEFAULT_DIALING_CODES);
    expect(parts.dialCode).toBe(DEFAULT_DIALING_CODES[0]?.dialCode);
    expect(parts.national).toBe('999999');
  });

  it('handles an empty value', () => {
    expect(splitPhoneNumber('')).toEqual({ dialCode: '233', national: '' });
  });
});

describe('joinPhoneNumber', () => {
  it('builds an E.164 string', () => {
    expect(joinPhoneNumber('233', '555 123 456')).toBe('+233555123456');
  });

  it('returns an empty value while the national part is empty', () => {
    expect(joinPhoneNumber('233', '')).toBe('');
    expect(joinPhoneNumber('233', '  ')).toBe('');
  });

  it('round-trips with splitPhoneNumber', () => {
    const joined = joinPhoneNumber('44', '2079460958');
    expect(splitPhoneNumber(joined)).toEqual({ dialCode: '44', national: '2079460958' });
  });
});

describe('formatNationalNumber', () => {
  it('groups digits for display', () => {
    expect(formatNationalNumber('5551234567')).toBe('555 123 4567');
    expect(formatNationalNumber('2079460958')).toBe('207 946 0958');
    expect(formatNationalNumber('123')).toBe('123');
    expect(formatNationalNumber('')).toBe('');
  });
});

describe('isPossiblePhoneNumber', () => {
  it('enforces the E.164 digit bounds', () => {
    expect(isPossiblePhoneNumber('+233555123456')).toBe(true);
    expect(isPossiblePhoneNumber('+123')).toBe(false);
    expect(isPossiblePhoneNumber('+1234567890123456789')).toBe(false);
  });
});
