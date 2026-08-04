import type { LoanQuoteRequest } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { LoansRepository } from '../infrastructure/loans.repository.js';
import { LoansService } from '../loans.service.js';
import { NOW } from './fixtures.js';

function setup(tier: 'standard' | 'plus' | 'premier' | 'private' = 'standard') {
  const repository = {
    profile: vi.fn().mockResolvedValue({ tier, kycLevel: null, kycVerified: false }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoansService(repository as unknown as LoansRepository, clock);
  return { service, repository };
}

function quoteRequest(overrides: Partial<LoanQuoteRequest> = {}): LoanQuoteRequest {
  return {
    productCode: 'PERSONAL_STANDARD',
    amount: { minorUnits: 500_000, currency: 'USD', scale: 2 },
    termMonths: 36,
    frequency: 'monthly',
    ...overrides,
  };
}

describe('LoansService.products', () => {
  it('returns the full lending catalogue', () => {
    const { service } = setup();

    const products = service.products();

    expect(products.map((product) => product.code)).toEqual([
      'PERSONAL_STANDARD',
      'DEBT_CONSOLIDATION',
      'VEHICLE_FINANCE',
      'HOME_IMPROVEMENT',
      'BUSINESS_TERM',
    ]);
  });
});

describe('LoansService.quote', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('prices an indicative quote from the relationship tier and the frozen clock', async () => {
    const quote = await context.service.quote('cust-1', quoteRequest());

    expect(context.repository.profile).toHaveBeenCalledWith('cust-1');
    expect(quote).toMatchObject({
      productCode: 'PERSONAL_STANDARD',
      amount: { minorUnits: 500_000, currency: 'USD' },
      termMonths: 36,
      frequency: 'monthly',
      nominalRate: 16.9,
      arrangementFee: { minorUnits: 5_000, currency: 'USD' },
      firstPaymentOn: '2026-09-04',
      indicative: true,
    });
    expect(quote.schedule).toHaveLength(36);
    expect(quote.totalRepayable.minorUnits).toBeGreaterThan(500_000);
  });

  it('prices a premier relationship nearer the headline rate', async () => {
    context = setup('premier');

    const quote = await context.service.quote('cust-1', quoteRequest());

    expect(quote.nominalRate).toBeCloseTo(10.9, 4);
  });

  it('refuses an unknown product code', async () => {
    await expect(
      context.service.quote('cust-1', quoteRequest({ productCode: 'NOPE' })),
    ).rejects.toThrow(NotFoundError);
    expect(context.repository.profile).not.toHaveBeenCalled();
  });

  it('refuses a currency the product is not sold in', async () => {
    await expect(
      context.service.quote(
        'cust-1',
        // Deliberately not the catalogue currency — that is the whole point of this test.
        quoteRequest({ amount: { minorUnits: 500_000, currency: 'GBP', scale: 2 } }),
      ),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error);
    expect(context.repository.profile).not.toHaveBeenCalled();
  });

  it('refuses an amount below the product band', async () => {
    await expect(
      context.service.quote(
        'cust-1',
        quoteRequest({ amount: { minorUnits: 99_999, currency: 'USD', scale: 2 } }),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('refuses an amount above the product band', async () => {
    await expect(
      context.service.quote(
        'cust-1',
        quoteRequest({ amount: { minorUnits: 5_000_001, currency: 'USD', scale: 2 } }),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('refuses a term outside the product band', async () => {
    await expect(context.service.quote('cust-1', quoteRequest({ termMonths: 5 }))).rejects.toThrow(
      ValidationError,
    );
    await expect(context.service.quote('cust-1', quoteRequest({ termMonths: 85 }))).rejects.toThrow(
      ValidationError,
    );
    expect(context.repository.profile).not.toHaveBeenCalled();
  });
});

describe('LoansService quote errors are DomainError subclasses', () => {
  it('surfaces band refusals as domain errors, not crashes', async () => {
    const { service } = setup();

    await expect(
      service.quote(
        'cust-1',
        quoteRequest({ amount: { minorUnits: 1, currency: 'USD', scale: 2 } }),
      ),
    ).rejects.toThrow(DomainError);
  });
});
