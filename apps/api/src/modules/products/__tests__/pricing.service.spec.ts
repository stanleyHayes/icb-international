import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { FeeNotFoundError, NoEffectiveRateError } from '../domain/product-errors.js';
import type { FeeRow, ProductDoc } from '../infrastructure/product.schemas.js';
import { PricingService } from '../pricing.service.js';
import type { ProductsService } from '../products.service.js';
import type { RatesService } from '../rates.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function feeRow(overrides: Partial<FeeRow> = {}): FeeRow {
  return {
    code: 'WIRE-OUT',
    label: 'Outgoing wire',
    basis: 'percentage',
    amountMinorUnits: null,
    percentage: 1,
    tiers: [],
    minimumMinorUnits: null,
    maximumMinorUnits: null,
    waivedForTiers: [],
    ...overrides,
  };
}

function productDoc(overrides: Partial<ProductDoc> = {}): ProductDoc {
  return {
    code: 'ICB-SAVINGS',
    interestRate: 4.15,
    rateSchedule: [],
    fees: [],
    eligibility: { minimumAge: 18, minimumKycLevel: 'tier_1', residentsOnly: false, businessOnly: false },
    limits: [
      {
        kycLevel: 'tier_1',
        singleTransactionMinorUnits: null,
        dailyMinorUnits: null,
        monthlyMinorUnits: null,
        maxBalanceMinorUnits: 1_000_000,
        overdraftMinorUnits: 0,
      },
    ],
    ...overrides,
  } as ProductDoc;
}

function setup(doc: ProductDoc | null = productDoc()) {
  const model = { findOneAndUpdate: vi.fn() };
  const catalogue = { documentFor: vi.fn().mockResolvedValue(doc) };
  const rates = { invalidate: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new PricingService(
    model as unknown as Model<ProductDoc>,
    catalogue as unknown as ProductsService,
    rates as unknown as RatesService,
    clock,
  );
  return { model, catalogue, rates, service };
}

describe('resolveRate', () => {
  it('resolves the schedule entry in force at the clock instant', async () => {
    const { service } = setup(
      productDoc({ rateSchedule: [{ effectiveFrom: new Date('2026-07-01T00:00:00.000Z'), rate: 4.5 }] }),
    );
    await expect(service.resolveRate('ICB-SAVINGS')).resolves.toBe(4.5);
  });

  it('falls back to the base rate when no schedule entry is in force', async () => {
    const { service } = setup();
    await expect(service.resolveRate('ICB-SAVINGS')).resolves.toBe(4.15);
  });

  it('honours an explicit as-of instant over the clock', async () => {
    const { service } = setup(
      productDoc({ rateSchedule: [{ effectiveFrom: new Date('2026-07-01T00:00:00.000Z'), rate: 4.5 }] }),
    );
    const before = new Date('2026-06-01T00:00:00.000Z');
    await expect(service.resolveRate('ICB-SAVINGS', before)).resolves.toBe(4.15);
  });

  it('throws NoEffectiveRateError when neither schedule nor base rate exists', async () => {
    const { service } = setup(productDoc({ interestRate: null }));
    await expect(service.resolveRate('ICB-SAVINGS')).rejects.toThrow(NoEffectiveRateError);
  });
});

describe('addRateChange', () => {
  const change = { effectiveFrom: new Date('2026-09-01T00:00:00.000Z'), rate: 4.75 };

  it('persists the ordered schedule and invalidates the rates cache', async () => {
    const { model, rates, service } = setup();
    const updated = productDoc({ rateSchedule: [change] });
    model.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(updated) });

    const schedule = await service.addRateChange('ICB-SAVINGS', change);

    expect(schedule).toEqual([change]);
    expect(rates.invalidate).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate effective instant before any write', async () => {
    const { model, service } = setup(productDoc({ rateSchedule: [change] }));

    await expect(service.addRateChange('ICB-SAVINGS', change)).rejects.toThrow(ConflictError);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('rateScheduleFor', () => {
  it('returns the stored schedule, including changes not yet in force', async () => {
    const future = { effectiveFrom: new Date('2026-12-01T00:00:00.000Z'), rate: 5.0 };
    const past = { effectiveFrom: new Date('2026-07-01T00:00:00.000Z'), rate: 4.5 };
    const { service } = setup(productDoc({ rateSchedule: [past, future] }));

    await expect(service.rateScheduleFor('ICB-SAVINGS')).resolves.toEqual([past, future]);
  });

  it('propagates the catalogue miss for an unknown product', async () => {
    const { service, catalogue } = setup();
    catalogue.documentFor.mockRejectedValue(new NotFoundError('Product', 'NOPE'));

    await expect(service.rateScheduleFor('NOPE')).rejects.toThrow(NotFoundError);
  });
});

describe('quoteFee', () => {
  it('calculates the fee from the product fee schedule', async () => {
    const { service } = setup(productDoc({ fees: [feeRow()] }));

    const quoted = await service.quoteFee('ICB-SAVINGS', 'WIRE-OUT', fromMinorUnits(100_000, 'USD'), 'standard');

    expect(quoted.minorUnits).toBe(1_000);
  });

  it('waives the fee for a waived tier', async () => {
    const { service } = setup(productDoc({ fees: [feeRow({ waivedForTiers: ['premier'] })] }));

    const quoted = await service.quoteFee('ICB-SAVINGS', 'WIRE-OUT', fromMinorUnits(100_000, 'USD'), 'premier');

    expect(quoted.minorUnits).toBe(0);
  });

  it('throws FeeNotFoundError for a fee the product does not define', async () => {
    const { service } = setup();
    await expect(
      service.quoteFee('ICB-SAVINGS', 'ATM', fromMinorUnits(100, 'USD'), 'standard'),
    ).rejects.toThrow(FeeNotFoundError);
  });
});

describe('checkEligibility', () => {
  it('evaluates the stored rules against the customer facts', async () => {
    const { service } = setup();

    const result = await service.checkEligibility('ICB-SAVINGS', {
      ageYears: 17,
      kycLevel: null,
      resident: true,
      customerType: 'individual',
    });

    expect(result.eligible).toBe(false);
    expect(result.failures.map((failure) => failure.rule)).toEqual(['minimum_age', 'kyc_level']);
  });
});

describe('limitsFor', () => {
  it('returns the tier-1 row for an unverified customer', async () => {
    const { service } = setup();

    const limits = await service.limitsFor('ICB-SAVINGS', null);

    expect(limits?.maxBalanceMinorUnits).toBe(1_000_000);
  });

  it('returns null when the matrix has no applicable row', async () => {
    const { service } = setup(productDoc({ limits: [] }));
    await expect(service.limitsFor('ICB-SAVINGS', 'tier_3')).resolves.toBeNull();
  });
});
