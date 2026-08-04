import { describe, expect, it } from 'vitest';

import { BILLER_DIRECTORY } from '../domain/biller-directory.js';

/**
 * The directory is data, but it is data the money paths trust: a duplicated code, an invalid
 * pattern, or an out-of-range failure rate would corrupt payments or seeding. These checks keep
 * the seed rows honest without touching a database.
 */
describe('BILLER_DIRECTORY', () => {
  it('has unique biller codes', () => {
    const codes = BILLER_DIRECTORY.map((biller) => biller.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('gives every biller a compilable reference pattern or none at all', () => {
    for (const biller of BILLER_DIRECTORY) {
      const pattern = biller.referencePattern;
      if (pattern !== null) {
        expect(() => new RegExp(pattern, 'u')).not.toThrow();
      }
    }
  });

  it('keeps commercial facts in sane ranges', () => {
    for (const biller of BILLER_DIRECTORY) {
      expect(biller.feeMinorUnits).toBeGreaterThanOrEqual(0);
      expect(biller.failureRate).toBeGreaterThanOrEqual(0);
      expect(biller.failureRate).toBeLessThanOrEqual(1);
      expect(biller.typicalBillMinorUnits).toBeGreaterThan(0);
      if (biller.minimumAmountMinorUnits !== null) {
        expect(biller.minimumAmountMinorUnits).toBeGreaterThan(0);
      }
    }
  });
});
