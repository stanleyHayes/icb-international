import { describe, expect, it } from 'vitest';

import { draftToMinorUnits, minorUnitsToDraft, sanitizeMoneyDraft } from '../money-mask';

describe('sanitizeMoneyDraft', () => {
  it('keeps digits and a single separator', () => {
    expect(sanitizeMoneyDraft('1,234.56', 'USD')).toBe('1234.56');
    expect(sanitizeMoneyDraft('12.34.56', 'USD')).toBe('12.34');
    expect(sanitizeMoneyDraft('abc', 'USD')).toBe('');
  });

  it('caps the fraction at the currency scale', () => {
    expect(sanitizeMoneyDraft('1.999', 'USD')).toBe('1.99');
    expect(sanitizeMoneyDraft('1.9999', 'KWD')).toBe('1.999');
  });

  it('drops the separator entirely for zero-scale currencies', () => {
    expect(sanitizeMoneyDraft('123.45', 'JPY')).toBe('123');
    expect(sanitizeMoneyDraft('123', 'JPY')).toBe('123');
  });

  it('preserves a trailing separator while typing', () => {
    expect(sanitizeMoneyDraft('12.', 'USD')).toBe('12.');
  });

  it('collapses leading zeros and keeps a leading minus', () => {
    expect(sanitizeMoneyDraft('007.50', 'USD')).toBe('7.50');
    expect(sanitizeMoneyDraft('-12.34', 'USD')).toBe('-12.34');
  });
});

describe('draftToMinorUnits', () => {
  it('converts without floats', () => {
    expect(draftToMinorUnits('1234.56', 'USD')).toBe(123456);
    expect(draftToMinorUnits('0.10', 'USD')).toBe(10);
    expect(draftToMinorUnits('999', 'JPY')).toBe(999);
    expect(draftToMinorUnits('1.001', 'KWD')).toBe(1001);
  });

  it('pads a short fraction to the currency scale', () => {
    expect(draftToMinorUnits('5.4', 'USD')).toBe(540);
    expect(draftToMinorUnits('7', 'USD')).toBe(700);
  });

  it('returns null for empty or incomplete drafts', () => {
    expect(draftToMinorUnits('', 'USD')).toBeNull();
    expect(draftToMinorUnits('-', 'USD')).toBeNull();
    expect(draftToMinorUnits('abc', 'USD')).toBeNull();
  });

  it('treats a trailing separator as complete on blur', () => {
    expect(draftToMinorUnits('12.', 'USD')).toBe(1200);
  });

  it('keeps the sign', () => {
    expect(draftToMinorUnits('-9.99', 'USD')).toBe(-999);
  });
});

describe('minorUnitsToDraft', () => {
  it('renders the canonical decimal for the scale', () => {
    expect(minorUnitsToDraft(123456, 'USD')).toBe('1234.56');
    expect(minorUnitsToDraft(999, 'JPY')).toBe('999');
    expect(minorUnitsToDraft(1001, 'KWD')).toBe('1.001');
  });

  it('round-trips through draftToMinorUnits', () => {
    for (const minor of [0, 1, 10, 540, 123456, -999]) {
      expect(draftToMinorUnits(minorUnitsToDraft(minor, 'USD'), 'USD')).toBe(minor);
    }
  });
});
