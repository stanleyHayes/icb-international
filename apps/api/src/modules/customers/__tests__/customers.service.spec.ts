import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { CustomersService } from '../customers.service.js';
import { CustomerClosedError } from '../domain/customer-errors.js';
import type { CustomerDoc } from '../infrastructure/customer.schemas.js';
import { chainQuery, customerDoc } from './fixtures.js';

function setup(doc: CustomerDoc | null) {
  const model = {
    findById: vi.fn().mockReturnValue(chainQuery(doc)),
    findOneAndUpdate: vi.fn().mockReturnValue(chainQuery(doc)),
  };
  const service = new CustomersService(model as unknown as Model<CustomerDoc>);
  return { model, service };
}

describe('me', () => {
  it('maps the stored document to the profile contract', async () => {
    const { service } = setup(customerDoc());

    const profile = await service.me('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');

    expect(profile.id).toBe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
    expect(profile.email).toBe('ama@example.com');
    expect(profile.status).toBe('active');
    expect(profile.kyc.verifiedAt).toBe('2026-08-02T12:00:00.000Z');
    expect(profile.memberSince).toBe('2026-08-02T12:00:00.000Z');
  });

  it('throws a typed not-found for an unknown customer', async () => {
    const { service } = setup(null);
    await expect(service.me('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('updateProfile', () => {
  it('writes a flattened patch and returns the fresh document', async () => {
    const { model, service } = setup(customerDoc());

    const profile = await service.updateProfile('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', {
      individual: { employer: 'ICB' },
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0' },
      { $set: { 'individual.employer': 'ICB' } },
      { new: true },
    );
    expect(profile.id).toBe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
  });

  it('refuses to edit a closed customer', async () => {
    const { model, service } = setup(customerDoc({ status: 'closed' }));

    await expect(
      service.updateProfile('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { phone: '+233200000001' }),
    ).rejects.toThrow(CustomerClosedError);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects individual fields on a business customer', async () => {
    const { service } = setup(customerDoc({ type: 'business', individual: null }));

    await expect(
      service.updateProfile('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { individual: { firstName: 'Ama' } }),
    ).rejects.toThrow(ValidationError);
  });

  it('treats an empty request as a no-op read, with no write issued', async () => {
    const { model, service } = setup(customerDoc());

    const profile = await service.updateProfile('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', {});

    expect(profile.id).toBe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('updatePreferences', () => {
  it('writes only the mentioned preference keys', async () => {
    const { model, service } = setup(customerDoc());

    await service.updatePreferences('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { marketingEmail: true });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0' },
      { $set: { 'preferences.marketingEmail': true } },
      { new: true },
    );
  });

  it('refuses to edit preferences on a closed customer', async () => {
    const { service } = setup(customerDoc({ status: 'closed' }));

    await expect(
      service.updatePreferences('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { marketingEmail: true }),
    ).rejects.toThrow(CustomerClosedError);
  });
});
