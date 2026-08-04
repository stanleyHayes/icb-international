import type { LinkBillRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { BillersService } from '../billers.service.js';
import { BillsService } from '../bills.service.js';
import { enquireBalance } from '../domain/simulated-biller.js';
import type { LinkedBillDoc } from '../infrastructure/bill.schemas.js';
import {
  BILL_ID,
  BILLER_ID,
  CUSTOMER_ID,
  CYCLE,
  METER_REFERENCE,
  NOW,
  billerDoc,
  chainQuery,
} from './fixtures.js';

function setup() {
  const model = {
    create: vi.fn().mockImplementation((docs: unknown[]) => Promise.resolve(docs)),
    exists: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockReturnValue(chainQuery([])),
    findOne: vi.fn().mockReturnValue(chainQuery(null)),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const billers = {
    requireActive: vi.fn().mockResolvedValue(billerDoc()),
    findByIds: vi.fn().mockResolvedValue(new Map([[BILLER_ID, billerDoc()]])),
    get: vi.fn().mockResolvedValue(billerDoc()),
  };
  const accounts = { loadSpendable: vi.fn().mockResolvedValue({}) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BillsService(
    model as unknown as Model<LinkedBillDoc>,
    billers as unknown as BillersService,
    accounts as unknown as AccountsService,
    clock,
  );
  return { service, model, billers, accounts };
}

function linkRequest(overrides: Partial<LinkBillRequest> = {}): LinkBillRequest {
  return { billerId: BILLER_ID, customerReference: METER_REFERENCE, ...overrides };
}

describe('BillsService.link', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('links the bill with the opening balance enquiry in the same breath', async () => {
    const enquiry = enquireBalance(billerDoc(), METER_REFERENCE, CYCLE);

    const result = await deps.service.link(CUSTOMER_ID, linkRequest({ nickname: 'Home' }));

    expect(deps.billers.requireActive).toHaveBeenCalledWith(BILLER_ID);
    expect(deps.model.exists).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      billerId: BILLER_ID,
      customerReference: METER_REFERENCE,
    });
    expect(deps.model.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customerId: CUSTOMER_ID,
          billerId: BILLER_ID,
          customerReference: METER_REFERENCE,
          nickname: 'Home',
          currency: 'GBP',
          outstandingMinorUnits: enquiry?.outstandingMinorUnits,
          dueOn: enquiry?.dueOn,
          enquiryCycle: CYCLE,
          enquiredAt: NOW,
          createdAt: NOW,
        }),
      ],
      { ordered: true },
    );
    expect(result.billerName).toBe('National Grid Power — Postpaid');
    expect(result.outstandingBalance?.minorUnits).toBe(enquiry?.outstandingMinorUnits);
    expect(result.dueOn).toBe(enquiry?.dueOn);
  });

  it('links without a balance when the biller publishes none', async () => {
    const prepaid = billerDoc({ supportsBalanceEnquiry: false, referencePattern: null });
    deps.billers.requireActive.mockResolvedValue(prepaid);

    const result = await deps.service.link(CUSTOMER_ID, linkRequest());

    expect(deps.model.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          nickname: null,
          outstandingMinorUnits: null,
          dueOn: null,
          enquiryCycle: null,
          enquiredAt: null,
        }),
      ],
      { ordered: true },
    );
    expect(result.outstandingBalance).toBeNull();
    expect(result.dueOn).toBeNull();
  });

  it('rejects a reference that does not match the biller pattern before any write', async () => {
    await expect(
      deps.service.link(CUSTOMER_ID, linkRequest({ customerReference: 'not-a-meter' })),
    ).rejects.toThrow(ValidationError);
    expect(deps.model.exists).not.toHaveBeenCalled();
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('rejects linking the same reference at the same biller twice', async () => {
    deps.model.exists.mockResolvedValue({ _id: BILL_ID });

    await expect(deps.service.link(CUSTOMER_ID, linkRequest())).rejects.toThrow(ConflictError);
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('throws a conflict when the insert returns nothing', async () => {
    deps.model.create.mockResolvedValue([]);

    await expect(deps.service.link(CUSTOMER_ID, linkRequest())).rejects.toThrow(ConflictError);
  });

  it('propagates the conflict for a withdrawn biller', async () => {
    deps.billers.requireActive.mockRejectedValue(new ConflictError('no longer accepting'));

    await expect(deps.service.link(CUSTOMER_ID, linkRequest())).rejects.toThrow(ConflictError);
    expect(deps.model.create).not.toHaveBeenCalled();
  });
});

describe('BillsService.unlink', () => {
  it('deletes the bill scoped to the owning customer', async () => {
    const { service, model } = setup();

    await service.unlink(BILL_ID, CUSTOMER_ID);

    expect(model.deleteOne).toHaveBeenCalledWith({ _id: BILL_ID, customerId: CUSTOMER_ID });
  });

  it('throws a typed not-found when nothing was deleted', async () => {
    const { service, model } = setup();
    model.deleteOne.mockResolvedValue({ deletedCount: 0 });

    await expect(service.unlink(BILL_ID, CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });
});
