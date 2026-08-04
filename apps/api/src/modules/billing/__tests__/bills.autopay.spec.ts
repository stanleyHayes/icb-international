import type { ConfigureAutopayRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { BillersService } from '../billers.service.js';
import { BillsService } from '../bills.service.js';
import type { LinkedBillDoc } from '../infrastructure/bill.schemas.js';
import {
  ACCOUNT_ID,
  BILL_ID,
  BILLER_ID,
  CUSTOMER_ID,
  NOW,
  billerDoc,
  chainQuery,
  linkedBillDoc,
} from './fixtures.js';

function setup(bill: LinkedBillDoc | null = linkedBillDoc()) {
  const model = {
    find: vi.fn().mockReturnValue(chainQuery([])),
    findOne: vi.fn().mockReturnValue(chainQuery(bill)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const billers = {
    requireActive: vi.fn().mockResolvedValue(billerDoc()),
    findByIds: vi.fn().mockResolvedValue(new Map([[BILLER_ID, billerDoc()]])),
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

function autopayRequest(overrides: Partial<ConfigureAutopayRequest> = {}): ConfigureAutopayRequest {
  return {
    enabled: true,
    fromAccountId: ACCOUNT_ID,
    strategy: 'fixed_amount',
    fixedAmount: { minorUnits: 10_000, currency: 'GBP', scale: 2 },
    daysBeforeDue: 3,
    capAmount: { minorUnits: 20_000, currency: 'GBP', scale: 2 },
    ...overrides,
  };
}

describe('BillsService.configureAutopay', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('stores the rule flat after proving the funding account is usable', async () => {
    const result = await deps.service.configureAutopay(BILL_ID, CUSTOMER_ID, autopayRequest());

    expect(deps.accounts.loadSpendable).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID, customerId: CUSTOMER_ID },
      {
        $set: {
          autopayEnabled: true,
          autopayFromAccountId: ACCOUNT_ID,
          autopayStrategy: 'fixed_amount',
          autopayFixedMinorUnits: 10_000,
          autopayDaysBeforeDue: 3,
          autopayCapMinorUnits: 20_000,
        },
      },
    );
    expect(result.autopay).toMatchObject({
      enabled: true,
      fromAccountId: ACCOUNT_ID,
      strategy: 'fixed_amount',
      fixedAmount: { minorUnits: 10_000 },
      capAmount: { minorUnits: 20_000 },
    });
  });

  it('stores nulls for the optional amounts when they are omitted', async () => {
    await deps.service.configureAutopay(
      BILL_ID,
      CUSTOMER_ID,
      autopayRequest({ strategy: 'full_balance', fixedAmount: undefined, capAmount: undefined }),
    );

    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID, customerId: CUSTOMER_ID },
      {
        $set: expect.objectContaining({
          autopayStrategy: 'full_balance',
          autopayFixedMinorUnits: null,
          autopayCapMinorUnits: null,
        }),
      },
    );
  });

  it('rejects a fixed-amount rule with no amount', async () => {
    await expect(
      deps.service.configureAutopay(
        BILL_ID,
        CUSTOMER_ID,
        autopayRequest({ fixedAmount: undefined }),
      ),
    ).rejects.toThrow(ValidationError);
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });

  it('rejects full-balance autopay for a biller that publishes no balance', async () => {
    deps.billers.requireActive.mockResolvedValue(billerDoc({ supportsBalanceEnquiry: false }));

    await expect(
      deps.service.configureAutopay(
        BILL_ID,
        CUSTOMER_ID,
        autopayRequest({ strategy: 'full_balance', fixedAmount: undefined }),
      ),
    ).rejects.toThrow(ConflictError);
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });

  it('throws a typed not-found for a bill the customer does not own', async () => {
    const { service, model } = setup(null);

    await expect(
      service.configureAutopay(BILL_ID, CUSTOMER_ID, autopayRequest()),
    ).rejects.toThrow(NotFoundError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('does not write when the funding account is not spendable', async () => {
    deps.accounts.loadSpendable.mockRejectedValue(new NotFoundError('Account', ACCOUNT_ID));

    await expect(
      deps.service.configureAutopay(BILL_ID, CUSTOMER_ID, autopayRequest()),
    ).rejects.toThrow(NotFoundError);
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });
});

describe('BillsService.recordPayment', () => {
  it('reduces the cached outstanding balance and stamps the payment', async () => {
    const { service, model } = setup();

    await service.recordPayment(linkedBillDoc({ outstandingMinorUnits: 12_000 }), 5_000, NOW);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID },
      { $set: { lastPaidAt: NOW, lastPaidMinorUnits: 5_000, outstandingMinorUnits: 7_000 } },
    );
  });

  it('never lets the outstanding balance go below zero', async () => {
    const { service, model } = setup();

    await service.recordPayment(linkedBillDoc({ outstandingMinorUnits: 5_000 }), 12_000, NOW);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID },
      { $set: expect.objectContaining({ outstandingMinorUnits: 0 }) },
    );
  });

  it('keeps a null outstanding balance null', async () => {
    const { service, model } = setup();

    await service.recordPayment(linkedBillDoc({ outstandingMinorUnits: null }), 5_000, NOW);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID },
      { $set: expect.objectContaining({ outstandingMinorUnits: null }) },
    );
  });
});

describe('BillsService.findDueAutopay', () => {
  it('queries enabled autopay bills due on or before the horizon', async () => {
    const bill = linkedBillDoc({ autopayEnabled: true, autopayFromAccountId: ACCOUNT_ID });
    const { service, model } = setup();
    model.find.mockReturnValue(chainQuery([bill]));

    const result = await service.findDueAutopay('2026-08-31');

    expect(model.find).toHaveBeenCalledWith({
      autopayEnabled: true,
      autopayFromAccountId: { $ne: null },
      dueOn: { $ne: null, $lte: '2026-08-31' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.bill._id).toBe(BILL_ID);
  });

  it('excludes bills whose biller is missing or withdrawn', async () => {
    const bill = linkedBillDoc({ autopayEnabled: true, autopayFromAccountId: ACCOUNT_ID });
    const orphan = linkedBillDoc({ _id: 'b2', billerId: 'unknown-biller' });
    const { service, model, billers } = setup();
    model.find.mockReturnValue(chainQuery([bill, orphan]));
    billers.findByIds.mockResolvedValue(new Map([[BILLER_ID, billerDoc({ active: false })]]));

    await expect(service.findDueAutopay('2026-08-31')).resolves.toEqual([]);
  });
});

describe('BillsService.markAutopayRun', () => {
  it('stamps the due date autopay has handled', async () => {
    const { service, model } = setup();

    await service.markAutopayRun(BILL_ID, '2026-08-18');

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: BILL_ID },
      { $set: { autopayLastDueOn: '2026-08-18' } },
    );
  });
});
