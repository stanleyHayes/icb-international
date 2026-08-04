import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
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
  NOW,
  billerDoc,
  chainQuery,
  linkedBillDoc,
} from './fixtures.js';

function setup(bill: LinkedBillDoc | null = linkedBillDoc()) {
  const model = {
    find: vi.fn().mockReturnValue(chainQuery(bill ? [bill] : [])),
    findOne: vi.fn().mockReturnValue(chainQuery(bill)),
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
  return { service, model, billers };
}

describe('BillsService.listForCustomer', () => {
  it('returns the customer bills newest first without re-enquiring a current cycle', async () => {
    const { service, model, billers } = setup();

    const result = await service.listForCustomer(CUSTOMER_ID);

    expect(model.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(billers.findByIds).toHaveBeenCalledWith([BILLER_ID]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(BILL_ID);
    expect(result[0]?.outstandingBalance?.minorUnits).toBe(18_500);
    // The cached enquiry belongs to the current cycle, so no refresh write happens.
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('re-runs the enquiry when the billing cycle has turned over', async () => {
    const stale = linkedBillDoc({ enquiryCycle: '2026-07', dueOn: '2026-07-18' });
    const { service, model } = setup(stale);
    const enquiry = enquireBalance(billerDoc(), stale.customerReference, CYCLE);

    const result = await service.listForCustomer(CUSTOMER_ID);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID },
      {
        $set: {
          outstandingMinorUnits: enquiry?.outstandingMinorUnits,
          dueOn: enquiry?.dueOn,
          enquiryCycle: CYCLE,
          enquiredAt: NOW,
        },
      },
    );
    expect(result[0]?.dueOn).toBe(enquiry?.dueOn);
  });

  it('never refreshes a biller that publishes no balance', async () => {
    const bill = linkedBillDoc({ enquiryCycle: null, outstandingMinorUnits: null, dueOn: null });
    const { service, model, billers } = setup(bill);
    const prepaid = billerDoc({ supportsBalanceEnquiry: false });
    billers.findByIds.mockResolvedValue(new Map([[BILLER_ID, prepaid]]));

    const result = await service.listForCustomer(CUSTOMER_ID);

    expect(model.updateOne).not.toHaveBeenCalled();
    expect(result[0]?.outstandingBalance).toBeNull();
  });

  it('skips bills whose biller has left the directory', async () => {
    const { service, billers } = setup();
    billers.findByIds.mockResolvedValue(new Map());

    await expect(service.listForCustomer(CUSTOMER_ID)).resolves.toEqual([]);
  });
});

describe('BillsService.getForCustomer', () => {
  it('returns the owned bill mapped with its biller', async () => {
    const { service, billers } = setup();

    const result = await service.getForCustomer(BILL_ID, CUSTOMER_ID);

    expect(billers.get).toHaveBeenCalledWith(BILLER_ID);
    expect(result.id).toBe(BILL_ID);
    expect(result.billerName).toBe('National Grid Power — Postpaid');
  });

  it('throws a typed not-found for a bill the customer does not own', async () => {
    const { service } = setup(null);

    await expect(service.getForCustomer(BILL_ID, CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('BillsService.loadOwned', () => {
  it('returns the bill and its still-active biller', async () => {
    const { service, billers } = setup();

    const result = await service.loadOwned(BILL_ID, CUSTOMER_ID);

    expect(billers.requireActive).toHaveBeenCalledWith(BILLER_ID);
    expect(result.bill._id).toBe(BILL_ID);
    expect(result.biller._id).toBe(BILLER_ID);
  });

  it('refuses the load when the biller has been withdrawn', async () => {
    const { service, billers } = setup();
    billers.requireActive.mockRejectedValue(new ConflictError('no longer accepting'));

    await expect(service.loadOwned(BILL_ID, CUSTOMER_ID)).rejects.toThrow(ConflictError);
  });
});
