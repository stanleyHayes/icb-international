import type { ConfigureAutopayRequest } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ConflictError, ValidationError } from '../../../common/errors/index.js';
import {
  assertAutopayViable,
  assertPayable,
  assertReferenceMatches,
  autopayAmountFor,
  autopayTriggerDate,
} from '../domain/bill-rules.js';
import { billerDoc } from './fixtures.js';

/** The fixture biller's `referencePattern`, which the field error quotes back verbatim. */
const METER_PATTERN = String.raw`^\d{10}$`;

describe('assertReferenceMatches', () => {
  it('accepts any reference when the biller has no pattern', () => {
    expect(() =>
      assertReferenceMatches(billerDoc({ referencePattern: null }), 'anything at all'),
    ).not.toThrow();
  });

  it('accepts a reference that matches the biller pattern', () => {
    expect(() => assertReferenceMatches(billerDoc(), '1234567890')).not.toThrow();
  });

  it('rejects a malformed reference with a field error naming the pattern', () => {
    try {
      assertReferenceMatches(billerDoc(), 'not-a-meter');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validation = error as ValidationError;
      expect(validation.message).toBe('Enter a valid meter number');
      expect(validation.fieldErrors).toEqual([
        {
          path: 'customerReference',
          message: `National Grid Power — Postpaid expects the format ${METER_PATTERN}`,
        },
      ]);
    }
  });
});

describe('assertAutopayViable', () => {
  const request = (overrides: Partial<ConfigureAutopayRequest> = {}): ConfigureAutopayRequest =>
    ({
      enabled: true,
      fromAccountId: 'acct-1',
      strategy: 'full_balance',
      daysBeforeDue: 2,
      ...overrides,
    });

  it('requires an amount for a fixed-amount strategy', () => {
    expect(() =>
      assertAutopayViable(request({ strategy: 'fixed_amount', fixedAmount: undefined }), billerDoc()),
    ).toThrow(ValidationError);
  });

  it('accepts a fixed-amount strategy with an amount', () => {
    expect(() =>
      assertAutopayViable(
        request({
          strategy: 'fixed_amount',
          fixedAmount: { minorUnits: 5000, currency: 'GBP', scale: 2 },
        }),
        billerDoc(),
      ),
    ).not.toThrow();
  });

  it('refuses full-balance autopay for a biller that publishes no balance', () => {
    expect(() =>
      assertAutopayViable(request(), billerDoc({ supportsBalanceEnquiry: false })),
    ).toThrow(ConflictError);
  });

  it('accepts full-balance autopay for a biller with balance enquiry', () => {
    expect(() => assertAutopayViable(request(), billerDoc())).not.toThrow();
  });
});

describe('assertPayable', () => {
  it('rejects a payment in the wrong currency', () => {
    try {
      assertPayable(billerDoc(), { minorUnits: 5000, currency: 'USD', scale: 2 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('ACCOUNT_CURRENCY_MISMATCH');
    }
  });

  it('rejects a payment below the biller minimum', () => {
    try {
      assertPayable(billerDoc(), { minorUnits: 499, currency: 'GBP', scale: 2 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('AMOUNT_BELOW_MINIMUM');
    }
  });

  it('accepts a payment at the minimum', () => {
    expect(() =>
      assertPayable(billerDoc(), { minorUnits: 500, currency: 'GBP', scale: 2 }),
    ).not.toThrow();
  });

  it('accepts any amount when the biller has no minimum', () => {
    expect(() =>
      assertPayable(billerDoc({ minimumAmountMinorUnits: null }), {
        minorUnits: 1,
        currency: 'GBP',
        scale: 2,
      }),
    ).not.toThrow();
  });
});

describe('autopayAmountFor', () => {
  it('uses the fixed amount for a fixed-amount strategy', () => {
    expect(autopayAmountFor('fixed_amount', 18_500, 5000, null)).toBe(5000);
  });

  it('falls back to zero when the fixed amount was never stored', () => {
    expect(autopayAmountFor('fixed_amount', 18_500, null, null)).toBe(0);
  });

  it('uses the outstanding balance for a full-balance strategy', () => {
    expect(autopayAmountFor('full_balance', 18_500, 5000, null)).toBe(18_500);
  });

  it('falls back to zero when no balance was ever enquired', () => {
    expect(autopayAmountFor('full_balance', null, null, null)).toBe(0);
  });

  it('applies the cap after the strategy', () => {
    expect(autopayAmountFor('full_balance', 18_500, null, 10_000)).toBe(10_000);
    expect(autopayAmountFor('full_balance', 9000, null, 10_000)).toBe(9000);
  });
});

describe('autopayTriggerDate', () => {
  it('subtracts the configured days from the due date', () => {
    expect(autopayTriggerDate('2026-08-10', 3)).toBe('2026-08-07');
  });

  it('crosses a month boundary', () => {
    expect(autopayTriggerDate('2026-03-01', 1)).toBe('2026-02-28');
  });
});
