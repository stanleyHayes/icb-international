import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { CustomerContactReader } from '../application/customer-contact.reader.js';
import { CUSTOMER_ID, leanQuery } from './fixtures.js';

interface ContactRow {
  email?: string;
  phone?: string;
  individual: Record<string, unknown> | null;
  business: Record<string, unknown> | null;
}

function setup(row: ContactRow | null) {
  const model = { findById: vi.fn().mockReturnValue(leanQuery(row)) };
  const reader = new CustomerContactReader(model as unknown as Model<CustomerDoc>);
  return { reader, model };
}

describe('CustomerContactReader.forCustomer', () => {
  it('reads only the contact fields from the customer document', async () => {
    const select = vi.fn().mockReturnValue({ lean: () => Promise.resolve(null) });
    const model = { findById: vi.fn().mockReturnValue({ select }) };
    const reader = new CustomerContactReader(model as unknown as Model<CustomerDoc>);

    await reader.forCustomer(CUSTOMER_ID);

    expect(model.findById).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(select).toHaveBeenCalledWith('email phone individual business');
  });

  it('answers an individual with their email, phone and first name', async () => {
    const { reader } = setup({
      email: 'ada@example.com',
      phone: '+447700900123',
      individual: { firstName: 'Ada' },
      business: null,
    });

    const contact = await reader.forCustomer(CUSTOMER_ID);

    expect(contact).toEqual({
      customerId: CUSTOMER_ID,
      email: 'ada@example.com',
      phone: '+447700900123',
      displayName: 'Ada',
    });
  });

  it('greets a business by its trading name', async () => {
    const { reader } = setup({
      email: 'ops@corner-shop.example',
      phone: '+442071234567',
      individual: null,
      business: { tradingName: 'Corner Shop Ltd' },
    });

    const contact = await reader.forCustomer(CUSTOMER_ID);

    expect(contact?.displayName).toBe('Corner Shop Ltd');
  });

  it('returns null for a customer id that does not exist', async () => {
    const { reader } = setup(null);

    await expect(reader.forCustomer(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('treats empty contact strings as absent', async () => {
    const { reader } = setup({
      email: '',
      phone: '',
      individual: { firstName: '' },
      business: { tradingName: '' },
    });

    const contact = await reader.forCustomer(CUSTOMER_ID);

    expect(contact).toEqual({ customerId: CUSTOMER_ID, email: null, phone: null, displayName: null });
  });

  it('falls back to the trading name when the individual has no usable first name', async () => {
    const { reader } = setup({
      email: 'a@b.example',
      phone: '+447700900123',
      individual: { firstName: 42 },
      business: { tradingName: 'Fallback & Co' },
    });

    const contact = await reader.forCustomer(CUSTOMER_ID);

    expect(contact?.displayName).toBe('Fallback & Co');
  });

  it('tolerates a document with no recorded contact fields at all', async () => {
    const { reader } = setup({ individual: null, business: null });

    const contact = await reader.forCustomer(CUSTOMER_ID);

    expect(contact).toEqual({ customerId: CUSTOMER_ID, email: null, phone: null, displayName: null });
  });
});
