import type { Product } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { ProductDoc } from '../infrastructure/product.schemas.js';
import { ProductsService } from '../products.service.js';
import type { RatesService } from '../rates.service.js';

function productDoc(overrides: Partial<ProductDoc> = {}): ProductDoc {
  return {
    _id: '01J00000000000000000000000',
    code: 'ICB-SAVINGS',
    name: 'ICB Reserve Savings',
    tagline: 'Watch your reserve grow',
    description: 'Interest-bearing savings.',
    kind: 'savings',
    currencies: ['USD'],
    interestRate: 4.15,
    interestBands: null,
    rateSchedule: [],
    minimumOpeningBalanceMinorUnits: null,
    minimumBalanceMinorUnits: null,
    monthlyFeeMinorUnits: null,
    fees: [],
    features: ['Interest accrued daily'],
    eligibility: { minimumAge: 18, minimumKycLevel: 'tier_1', residentsOnly: false, businessOnly: false },
    limits: [],
    depositTerms: [],
    loanRateRange: null,
    active: true,
    displayOrder: 2,
    version: 1,
    ...overrides,
  };
}

function setup() {
  const model = {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
  };
  const rates = { invalidate: vi.fn() };
  const service = new ProductsService(
    model as unknown as Model<ProductDoc>,
    rates as unknown as RatesService,
  );
  return { model, rates, service };
}

function chainable(resolved: unknown) {
  return { sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(resolved) }) };
}

describe('list', () => {
  it('returns active products mapped to the contract shape', async () => {
    const { model, service } = setup();
    model.find.mockReturnValue(chainable([productDoc()]));

    const products = await service.list();

    expect(model.find).toHaveBeenCalledWith({ active: true });
    expect(products[0]).toMatchObject({ code: 'ICB-SAVINGS', kind: 'savings', interestRate: 4.15 });
  });
});

describe('getByCode', () => {
  it('returns the product when found', async () => {
    const { model, service } = setup();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(productDoc()) });

    const product = await service.getByCode('ICB-SAVINGS');

    expect(product.code).toBe('ICB-SAVINGS');
  });

  it('throws a typed NotFoundError for an unknown code', async () => {
    const { model, service } = setup();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(service.getByCode('NOPE')).rejects.toThrow(NotFoundError);
  });
});

describe('create', () => {
  const input: Product = {
    code: 'ICB-SAVINGS',
    name: 'ICB Reserve Savings',
    tagline: 'Watch your reserve grow',
    description: 'Interest-bearing savings.',
    kind: 'savings',
    currencies: ['USD'],
    interestRate: 4.15,
    interestBands: null,
    minimumOpeningBalance: null,
    minimumBalance: null,
    monthlyFee: null,
    fees: [],
    features: ['Interest accrued daily'],
    eligibility: { minimumAge: 18, minimumKycLevel: 'tier_1', residentsOnly: false, businessOnly: false },
    active: true,
    displayOrder: 2,
  };

  it('rejects a duplicate code before touching the database write path', async () => {
    const { model, service } = setup();
    model.exists.mockResolvedValue({ _id: 'x' });

    await expect(service.create(input)).rejects.toThrow(ConflictError);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('persists and invalidates the cached rates table', async () => {
    const { model, rates, service } = setup();
    model.exists.mockResolvedValue(null);
    model.create.mockResolvedValue([productDoc()]);

    const created = await service.create(input);

    expect(created.code).toBe('ICB-SAVINGS');
    expect(rates.invalidate).toHaveBeenCalledOnce();
  });
});

describe('update', () => {
  it('merges the patch, bumps the version, and invalidates the cache', async () => {
    const { model, rates, service } = setup();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(productDoc()) });
    const lean = vi.fn().mockResolvedValue(productDoc({ tagline: 'New tagline', version: 2 }));
    model.findOneAndUpdate.mockReturnValue({ lean });

    const updated = await service.update('ICB-SAVINGS', { tagline: 'New tagline' });

    const [filter, write] = model.findOneAndUpdate.mock.calls[0] as [
      Record<string, unknown>,
      { $set: Record<string, unknown>; $inc: Record<string, number> },
    ];
    expect(filter).toEqual({ code: 'ICB-SAVINGS' });
    expect(write.$set['tagline']).toBe('New tagline');
    expect(write.$set['interestRate']).toBeCloseTo(4.15);
    expect(write.$inc).toEqual({ version: 1 });
    expect(updated.tagline).toBe('New tagline');
    expect(rates.invalidate).toHaveBeenCalledOnce();
  });

  it('keeps the code immutable even if the patch tries to change it', async () => {
    const { model, service } = setup();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(productDoc()) });
    model.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(productDoc()) });

    await service.update('ICB-SAVINGS', { code: 'HIJACKED' });

    const [, write] = model.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(write.$set['code']).toBe('ICB-SAVINGS');
  });

  it('throws NotFoundError when the product does not exist', async () => {
    const { model, service } = setup();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(service.update('NOPE', { tagline: 'x' })).rejects.toThrow(NotFoundError);
  });
});
