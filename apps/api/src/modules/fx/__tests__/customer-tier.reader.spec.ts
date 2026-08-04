import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { CustomerTierReader } from '../application/customer-tier.reader.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';

function setup(tier: string | null) {
  const model = {
    findById: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: () => Promise.resolve(tier === null ? null : { tier }),
      }),
    }),
  };
  const reader = new CustomerTierReader(model as unknown as Model<CustomerDoc>);
  return { reader, model };
}

describe('CustomerTierReader.tierFor', () => {
  it('returns the stored tier', async () => {
    const { reader } = setup('premier');
    expect(await reader.tierFor('cust-1')).toBe('premier');
  });

  it('returns null when the customer is missing', async () => {
    const { reader } = setup(null);
    expect(await reader.tierFor('cust-404')).toBeNull();
  });
});

describe('CustomerTierReader.spreadBpsFor', () => {
  it('maps a known tier to its spread', async () => {
    const { reader } = setup('plus');
    expect(await reader.spreadBpsFor('cust-1')).toBe(65);
  });

  it('pays the standard spread when the tier is absent', async () => {
    const { reader } = setup(null);
    expect(await reader.spreadBpsFor('cust-404')).toBe(90);
  });
});

describe('CustomerTierReader.asTier', () => {
  it('narrows each known tier to itself', () => {
    expect(CustomerTierReader.asTier('private')).toBe('private');
    expect(CustomerTierReader.asTier('standard')).toBe('standard');
  });

  it('defaults to standard for anything else', () => {
    expect(CustomerTierReader.asTier(null)).toBe('standard');
    expect(CustomerTierReader.asTier('ultra')).toBe('standard');
  });
});
