import type { CreateBeneficiaryRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { BeneficiaryTargetResolver } from '../application/beneficiary-target.resolver.js';
import { BeneficiariesService } from '../beneficiaries.service.js';
import type { BeneficiaryDoc } from '../infrastructure/beneficiary.schemas.js';
import { BENEFICIARY_ID, CUSTOMER_ID, DESTINATION, NOW, beneficiaryDoc, chainQuery } from './fixtures.js';

const TARGET = {
  displayIdentifier: '•••• 5678',
  bankName: null,
  currency: null,
  icbAccountId: null,
};

function request(overrides: Partial<CreateBeneficiaryRequest> = {}): CreateBeneficiaryRequest {
  return { name: 'Ama Mensah', destination: { ...DESTINATION }, favourite: false, ...overrides };
}

function setup(existing: BeneficiaryDoc | null = null) {
  const model = {
    create: vi.fn().mockImplementation((docs: unknown[]) => Promise.resolve(docs)),
    findOne: vi.fn().mockReturnValue(chainQuery(existing)),
    findOneAndUpdate: vi.fn().mockReturnValue(chainQuery(null)),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const targets = { resolve: vi.fn().mockResolvedValue(TARGET) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BeneficiariesService(
    model as unknown as Model<BeneficiaryDoc>,
    targets as unknown as BeneficiaryTargetResolver,
    clock,
  );
  return { service, model, targets };
}

describe('BeneficiariesService.create', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('resolves the destination, stores the payee, and starts the cooling-off clock', async () => {
    const created = await deps.service.create(CUSTOMER_ID, request({ nickname: 'Mum' }));

    expect(deps.targets.resolve).toHaveBeenCalledWith(request().destination, CUSTOMER_ID);
    const [stored] = deps.model.create.mock.calls[0]?.[0] as [BeneficiaryDoc];
    expect(stored.customerId).toBe(CUSTOMER_ID);
    expect(stored.destinationKey).toBe('domestic_bank:04067512345678');
    expect(stored.verified).toBe(false);
    expect(stored.verificationAttemptsRemaining).toBe(3);
    expect(created.nickname).toBe('Mum');
    expect(created.verified).toBe(false);
    expect(created.createdAt).toBe(NOW.toISOString());
    expect(created.coolingOffUntil).toBe('2026-08-04T14:00:00.000Z');
  });

  it('pre-checks the destination key and refuses a duplicate with a friendly error', async () => {
    const { service, model } = setup(beneficiaryDoc());

    await expect(service.create(CUSTOMER_ID, request())).rejects.toThrow(ConflictError);
    await expect(service.create(CUSTOMER_ID, request())).rejects.toMatchObject({
      context: { displayIdentifier: '•••• 5678' },
    });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('maps a unique-index race to the same conflict', async () => {
    deps.model.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11_000 }));

    await expect(deps.service.create(CUSTOMER_ID, request())).rejects.toThrow(ConflictError);
  });

  it('rethrows insert failures that are not duplicate keys', async () => {
    deps.model.create.mockRejectedValue(new Error('connection reset'));

    await expect(deps.service.create(CUSTOMER_ID, request())).rejects.toThrow('connection reset');
  });

  it('fails loudly when the insert returns nothing', async () => {
    deps.model.create.mockResolvedValue([]);

    await expect(deps.service.create(CUSTOMER_ID, request())).rejects.toThrow(
      'The beneficiary could not be saved',
    );
  });
});

describe('BeneficiariesService.get', () => {
  it('returns the owned payee mapped to the contract shape', async () => {
    const { service } = setup(beneficiaryDoc());

    const found = await service.get(CUSTOMER_ID, BENEFICIARY_ID);

    expect(found.id).toBe(BENEFICIARY_ID);
    expect(found.destination).toEqual(DESTINATION);
    expect(found.lastUsedAt).toBeNull();
  });

  it('throws a typed not-found for a payee the customer does not own', async () => {
    const { service } = setup(null);

    await expect(service.get(CUSTOMER_ID, BENEFICIARY_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('BeneficiariesService.update', () => {
  it('sets only the fields the request actually carries', async () => {
    const { service, model } = setup();
    model.findOneAndUpdate.mockReturnValue(chainQuery(beneficiaryDoc({ nickname: 'Gran' })));

    const updated = await service.update(CUSTOMER_ID, BENEFICIARY_ID, { nickname: 'Gran' });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: BENEFICIARY_ID, customerId: CUSTOMER_ID },
      { $set: { nickname: 'Gran' } },
      { new: true },
    );
    expect(updated.nickname).toBe('Gran');
  });

  it('sets both fields when both are supplied', async () => {
    const { service, model } = setup();
    model.findOneAndUpdate.mockReturnValue(
      chainQuery(beneficiaryDoc({ nickname: null, favourite: true })),
    );

    await service.update(CUSTOMER_ID, BENEFICIARY_ID, { nickname: null, favourite: true });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: BENEFICIARY_ID, customerId: CUSTOMER_ID },
      { $set: { nickname: null, favourite: true } },
      { new: true },
    );
  });

  it('throws a typed not-found when the ownership-scoped update matches nothing', async () => {
    const { service } = setup();

    await expect(service.update(CUSTOMER_ID, BENEFICIARY_ID, { favourite: true })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('BeneficiariesService.remove', () => {
  it('hard-deletes the owned payee', async () => {
    const { service, model } = setup();

    await service.remove(CUSTOMER_ID, BENEFICIARY_ID);

    expect(model.deleteOne).toHaveBeenCalledWith({ _id: BENEFICIARY_ID, customerId: CUSTOMER_ID });
  });

  it('throws a typed not-found when nothing was deleted', async () => {
    const { service, model } = setup();
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });

    await expect(service.remove(CUSTOMER_ID, BENEFICIARY_ID)).rejects.toThrow(NotFoundError);
  });
});
