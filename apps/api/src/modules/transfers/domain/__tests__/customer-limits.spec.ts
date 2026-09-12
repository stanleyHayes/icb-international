import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { LimitExceededError } from '../../../../common/errors/index.js';
import type { CustomerLimits } from '../../application/customer-limits.port.js';
import { InternationalNotPermittedError } from '../transfer-errors.js';
import { assertCustomerLimits, assertInternationalAllowed } from '../transfer-limits.js';

const usd = (minorUnits: number) => fromMinorUnits(minorUnits, 'USD');

/** Tier 1 as the ladder publishes it: 500 single, 1,000 daily, 5,000 monthly, no international. */
const tierOne: CustomerLimits = {
  label: 'tier 1',
  singleTransferMinorUnits: 50_000,
  dailyTransferMinorUnits: 100_000,
  monthlyTransferMinorUnits: 500_000,
  internationalAllowed: false,
};

const unbounded: CustomerLimits = {
  label: 'unverified',
  singleTransferMinorUnits: null,
  dailyTransferMinorUnits: null,
  monthlyTransferMinorUnits: null,
  internationalAllowed: true,
};

describe('assertCustomerLimits', () => {
  it('allows a transfer inside every ceiling', () => {
    expect(() => assertCustomerLimits(tierOne, usd(20_000), 0, 0)).not.toThrow();
  });

  it('refuses a single transfer above the tier ceiling', () => {
    // The figure the customer was shown on the limits screen is now the figure that bites.
    expect(() => assertCustomerLimits(tierOne, usd(60_000), 0, 0)).toThrow(LimitExceededError);
  });

  it('allows a transfer exactly on the ceiling', () => {
    expect(() => assertCustomerLimits(tierOne, usd(50_000), 0, 0)).not.toThrow();
  });

  it('counts the day’s earlier sends toward the daily ceiling', () => {
    // Each send is inside the single-transfer limit; together they are over the day's.
    expect(() => assertCustomerLimits(tierOne, usd(40_000), 70_000, 70_000)).toThrow(
      LimitExceededError,
    );
  });

  it('counts the month’s earlier sends toward the monthly ceiling', () => {
    expect(() => assertCustomerLimits(tierOne, usd(30_000), 0, 480_000)).toThrow(
      LimitExceededError,
    );
  });

  it('names the ceiling that bit, so a customer knows which one to act on', () => {
    expect(() => assertCustomerLimits(tierOne, usd(60_000), 0, 0)).toThrow(
      /tier 1 single-transfer limit/,
    );
    expect(() => assertCustomerLimits(tierOne, usd(40_000), 70_000, 0)).toThrow(
      /tier 1 daily transfer limit/,
    );
  });

  it('lets a null ceiling through', () => {
    expect(() => assertCustomerLimits(unbounded, usd(999_999_999), 0, 0)).not.toThrow();
  });

  it('compares in the debit currency rather than converting', () => {
    // The same convention the rail caps already use: the published number is the ceiling in
    // whatever is being sent, so a customer's limit never moves with an FX rate.
    const ghs = fromMinorUnits(60_000, 'GHS');
    expect(() => assertCustomerLimits(tierOne, ghs, 0, 0)).toThrow(LimitExceededError);
  });
});

describe('assertInternationalAllowed', () => {
  it('refuses SWIFT for a tier that has not unlocked it', () => {
    expect(() => assertInternationalAllowed(tierOne, 'swift')).toThrow(
      InternationalNotPermittedError,
    );
  });

  it('leaves every domestic rail alone', () => {
    for (const rail of ['internal', 'on_us', 'ach', 'wire'] as const) {
      expect(() => assertInternationalAllowed(tierOne, rail)).not.toThrow();
    }
  });

  it('allows SWIFT once the tier permits it', () => {
    expect(() => assertInternationalAllowed({ ...tierOne, internationalAllowed: true }, 'swift')).not.toThrow();
  });
});
