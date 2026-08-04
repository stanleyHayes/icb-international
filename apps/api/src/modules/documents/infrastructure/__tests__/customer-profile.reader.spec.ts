import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../../common/errors/index.js';
import type { CustomerDoc } from '../../../customers/infrastructure/customer.schemas.js';
import { CustomerProfileReader } from '../customer-profile.reader.js';

const CUSTOMER_ID = 'cust-1';
const MEMBER_SINCE = new Date('2024-01-15T00:00:00.000Z');

function leanQuery(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    lean: () => Promise.resolve(result),
  };
  return chain;
}

function setup() {
  const customers = { findById: vi.fn() };
  const reader = new CustomerProfileReader(customers as unknown as Model<CustomerDoc>);
  return { reader, customers };
}

function customerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: CUSTOMER_ID,
    email: 'ama@example.com',
    individual: null,
    business: null,
    memberSince: MEMBER_SINCE,
    ...overrides,
  };
}

describe('CustomerProfileReader.require', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('raises a typed not-found for a customer id that does not exist', async () => {
    context.customers.findById.mockReturnValue(leanQuery(null));

    await expect(context.reader.require('cust-9')).rejects.toBeInstanceOf(NotFoundError);
    expect(context.customers.findById).toHaveBeenCalledWith('cust-9');
  });

  it('prefers the trimmed business legal name over any personal name', async () => {
    const query = leanQuery(
      customerRow({
        business: { legalName: '  Mensah Trading Ltd  ' },
        individual: { firstName: 'Ama', lastName: 'Mensah' },
      }),
    );
    context.customers.findById.mockReturnValue(query);

    const profile = await context.reader.require(CUSTOMER_ID);

    expect(query.select).toHaveBeenCalledWith('individual business email memberSince');
    expect(profile).toEqual({ displayName: 'Mensah Trading Ltd', memberSince: '2024-01-15' });
  });

  it('joins the personal names when the legal name is blank', async () => {
    context.customers.findById.mockReturnValue(
      leanQuery(
        customerRow({
          business: { legalName: '   ' },
          individual: { firstName: 'Ama', lastName: 'Mensah' },
        }),
      ),
    );

    const profile = await context.reader.require(CUSTOMER_ID);

    expect(profile.displayName).toBe('Ama Mensah');
  });

  it('ignores non-string name parts stored in the open objects', async () => {
    context.customers.findById.mockReturnValue(
      leanQuery(
        customerRow({
          business: { legalName: 42 },
          individual: { firstName: 'Ama', lastName: 7 },
        }),
      ),
    );

    const profile = await context.reader.require(CUSTOMER_ID);

    expect(profile.displayName).toBe('Ama');
  });

  it('falls back to the email address when no name is stored at all', async () => {
    context.customers.findById.mockReturnValue(leanQuery(customerRow()));

    const profile = await context.reader.require(CUSTOMER_ID);

    expect(profile.displayName).toBe('ama@example.com');
  });
});
