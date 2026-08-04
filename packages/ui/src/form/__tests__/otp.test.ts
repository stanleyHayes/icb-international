import { describe, expect, it } from 'vitest';

import { isCompleteOtp, otpCells, otpFromPaste, setOtpCell } from '../otp';

describe('otpCells', () => {
  it('spreads digits across cells and pads with empties', () => {
    expect(otpCells('123', 6)).toEqual(['1', '2', '3', '', '', '']);
    expect(otpCells('', 4)).toEqual(['', '', '', '']);
  });

  it('ignores non-digits and truncates to length', () => {
    expect(otpCells('12 34-56', 4)).toEqual(['1', '2', '3', '4']);
    expect(otpCells('123456789', 6)).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

describe('setOtpCell', () => {
  it('replaces the digit at the index', () => {
    expect(setOtpCell('12', 1, '9', 6)).toBe('19');
    expect(setOtpCell('', 0, '5', 6)).toBe('5');
  });

  it('deletes and shifts when the digit is empty', () => {
    expect(setOtpCell('1234', 1, '', 6)).toBe('134');
  });

  it('strips non-digits from the replacement', () => {
    expect(setOtpCell('12', 0, 'a', 6)).toBe('2');
  });
});

describe('otpFromPaste', () => {
  it('collapses a formatted paste into plain digits', () => {
    expect(otpFromPaste('123 456', 6)).toBe('123456');
    expect(otpFromPaste('12-34-56', 6)).toBe('123456');
    expect(otpFromPaste('1234567890', 6)).toBe('123456');
    expect(otpFromPaste('no digits', 6)).toBe('');
  });
});

describe('isCompleteOtp', () => {
  it('is true only when every cell holds a digit', () => {
    expect(isCompleteOtp('123456', 6)).toBe(true);
    expect(isCompleteOtp('12345', 6)).toBe(false);
    expect(isCompleteOtp('12345a', 6)).toBe(false);
  });
});
