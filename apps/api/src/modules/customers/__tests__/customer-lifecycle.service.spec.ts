import type { CustomerAdminView } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CustomerLifecycleService } from '../customer-lifecycle.service.js';
import type { CustomersService } from '../customers.service.js';
import {
  CustomerKycIncompleteError,
  InvalidCustomerTransitionError,
} from '../domain/customer-errors.js';
import type { AdminViewAssembler } from '../infrastructure/admin-view.assembler.js';
import type { CustomerDoc } from '../infrastructure/customer.schemas.js';
import { chainQuery, customerDoc, NOW } from './fixtures.js';

const ACTOR = { id: 'staff-1', label: 'ope@icb.example' };
const REQUEST = { status: 'suspended' as const, reason: 'Fraud review underway' };

function setup(doc: CustomerDoc | null, writeResult: CustomerDoc | null = doc) {
  const model = {
    findOneAndUpdate: vi.fn().mockReturnValue(chainQuery(writeResult)),
  };
  const profiles = { require: vi.fn().mockResolvedValue(doc) };
  if (doc === null) {
    profiles.require.mockRejectedValue(new ConflictError('gone'));
  }
  const view = { id: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0' } as CustomerAdminView;
  const assembler = { assemble: vi.fn().mockResolvedValue(view) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CustomerLifecycleService(
    model as unknown as Model<CustomerDoc>,
    profiles as unknown as CustomersService,
    assembler as unknown as AdminViewAssembler,
    clock,
  );
  return { model, profiles, assembler, service, view };
}

describe('setStatus', () => {
  it('applies a legal transition and records it in the status history', async () => {
    const { model, assembler, service, view } = setup(customerDoc());

    const result = await service.setStatus('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', REQUEST, ACTOR);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0', status: 'active' },
      {
        $set: { status: 'suspended' },
        $push: {
          statusHistory: {
            from: 'active',
            to: 'suspended',
            reason: 'Fraud review underway',
            changedBy: 'ope@icb.example',
            changedAt: NOW,
          },
        },
      },
      { new: true },
    );
    expect(assembler.assemble).toHaveBeenCalled();
    expect(result).toBe(view);
  });

  it('rejects an illegal transition before touching the database', async () => {
    const { model, service } = setup(customerDoc({ status: 'closed' }));

    await expect(
      service.setStatus('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { status: 'active', reason: 'Reconsidered' }, ACTOR),
    ).rejects.toThrow(InvalidCustomerTransitionError);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('blocks activation while KYC is not approved', async () => {
    const { service } = setup(customerDoc({ status: 'pending_kyc', kycStatus: 'in_progress' }));

    await expect(
      service.setStatus('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { status: 'active', reason: 'Onboarding complete' }, ACTOR),
    ).rejects.toThrow(CustomerKycIncompleteError);
  });

  it('activates a KYC-approved pending customer', async () => {
    const { model, service } = setup(customerDoc({ status: 'pending_kyc', kycStatus: 'approved' }));

    await service.setStatus('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', { status: 'active', reason: 'Onboarding complete' }, ACTOR);

    expect(model.findOneAndUpdate).toHaveBeenCalled();
  });

  it('surfaces a lost race as a conflict rather than a silent overwrite', async () => {
    const { service } = setup(customerDoc(), null);

    await expect(service.setStatus('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', REQUEST, ACTOR)).rejects.toThrow(ConflictError);
  });
});
