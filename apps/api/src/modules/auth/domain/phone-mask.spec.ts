import { describe, expect, it } from 'vitest';

import { maskPhone } from './phone-mask.js';

describe('maskPhone', () => {
  it('keeps the country code and final digits only', () => {
    expect(maskPhone('+233244124521')).toBe('+233 ** *** 4521');
  });

  it('tolerates spaces and dashes in the stored format', () => {
    expect(maskPhone('+233 24 412 4521')).toBe('+233 ** *** 4521');
  });

  it('masks numbers without a country code', () => {
    expect(maskPhone('0244124521')).toBe('** *** 4521');
  });
});
