import type { PayBillRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, DomainError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { BillSettlementService } from '../bill-settlement.service.js';
import { BillPaymentsService } from '../bill-payments.service.js';
import type { BillsService } from '../bills.service.js';
import type { BillPaymentDoc } from '../infrastructure/bill-payment.schemas.js';
import {
  ACCOUNT_ID,
  BILL_ID,
  CUSTOMER_ID,
  NOW,
  billPaymentDoc,
  billerDoc,
  chainQuery,
  linkedBillDoc,
} from './fixtures.js';

function setup() {
  const model = {
    create: vi.fn().mockImplementation((docs: unknown[]) => Promise.resolve(docs)),
    find: vi.fn().mockReturnValue(chainQuery([])),
    findOne: vi.fn().mockReturnValue(chainQuery(null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const bills = {
    loadOwned: vi.fn().mockResolvedValue({ bill: linkedBillDoc(), biller: billerDoc() }),
  };
  // Settlement returns a completed payment: that is what settling means, and the fixture's
  // default 'processing' describes a payment still in flight.
  const settlement = { execute: vi.fn().mockResolvedValue(billPaymentDoc({ status: 'completed' })) };
  const accounts = { loadSpendable: vi.fn().mockResolvedValue({}) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BillPaymentsService(
    model as unknown as Model<BillPaymentDoc>,
    bills as unknown as BillsService,
    settlement as unknown as BillSettlementService,
    accounts as unknown as AccountsService,
    clock,
  );
  return { service, model, bills, settlement, accounts };
}

function payRequest(overrides: Partial<PayBillRequest> = {}): PayBillRequest {
  return {
    billId: BILL_ID,
    fromAccountId: ACCOUNT_ID,
    amount: { minorUnits: 12_000, currency: 'GBP', scale: 2 },
    ...overrides,
  };
}

describe('BillPaymentsService.pay', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('executes an immediate payment through settlement', async () => {
    const result = await deps.service.pay(CUSTOMER_ID, BILL_ID, payRequest());

    expect(deps.bills.loadOwned).toHaveBeenCalledWith(BILL_ID, CUSTOMER_ID);
    expect(deps.settlement.execute).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      bill: linkedBillDoc(),
      biller: billerDoc(),
      fromAccountId: ACCOUNT_ID,
      amountMinorUnits: 12_000,
      initiatedBy: 'customer',
    });
    expect(deps.model.create).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('rejects a body whose bill does not match the path before loading anything', async () => {
    await expect(
      deps.service.pay(CUSTOMER_ID, BILL_ID, payRequest({ billId: 'another-bill' })),
    ).rejects.toThrow(ValidationError);
    expect(deps.bills.loadOwned).not.toHaveBeenCalled();
  });

  it('rejects an amount in the wrong currency', async () => {
    await expect(
      deps.service.pay(
        CUSTOMER_ID,
        BILL_ID,
        payRequest({ amount: { minorUnits: 12_000, currency: 'USD', scale: 2 } }),
      ),
    ).rejects.toThrow(DomainError);
    expect(deps.settlement.execute).not.toHaveBeenCalled();
  });

  it('rejects an amount below the biller minimum', async () => {
    await expect(
      deps.service.pay(
        CUSTOMER_ID,
        BILL_ID,
        payRequest({ amount: { minorUnits: 100, currency: 'GBP', scale: 2 } }),
      ),
    ).rejects.toThrow(DomainError);
    expect(deps.settlement.execute).not.toHaveBeenCalled();
  });

  it('propagates the not-found for a bill the customer does not own', async () => {
    deps.bills.loadOwned.mockRejectedValue(new NotFoundError('Bill', BILL_ID));

    await expect(deps.service.pay(CUSTOMER_ID, BILL_ID, payRequest())).rejects.toThrow(
      NotFoundError,
    );
    expect(deps.settlement.execute).not.toHaveBeenCalled();
  });
});

describe('BillPaymentsService.pay scheduling', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('schedules a future payment without moving money today', async () => {
    const result = await deps.service.pay(
      CUSTOMER_ID,
      BILL_ID,
      payRequest({ scheduledFor: '2026-08-10' }),
    );

    expect(deps.accounts.loadSpendable).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(deps.settlement.execute).not.toHaveBeenCalled();
    expect(deps.model.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customerId: CUSTOMER_ID,
          billId: BILL_ID,
          billerId: billerDoc()._id,
          status: 'scheduled',
          fromAccountId: ACCOUNT_ID,
          amountMinorUnits: 12_000,
          feeMinorUnits: 100,
          valueDate: '2026-08-10',
          scheduledFor: new Date('2026-08-10T00:00:00.000Z'),
          transactionId: null,
          createdAt: NOW,
        }),
      ],
      { ordered: true },
    );
    expect(result.status).toBe('scheduled');
  });

  it('treats a scheduledFor of today as "now"', async () => {
    await deps.service.pay(CUSTOMER_ID, BILL_ID, payRequest({ scheduledFor: '2026-08-04' }));

    expect(deps.settlement.execute).toHaveBeenCalled();
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('does not schedule when the funding account is not spendable', async () => {
    deps.accounts.loadSpendable.mockRejectedValue(new NotFoundError('Account', ACCOUNT_ID));

    await expect(
      deps.service.pay(CUSTOMER_ID, BILL_ID, payRequest({ scheduledFor: '2026-08-10' })),
    ).rejects.toThrow(NotFoundError);
    expect(deps.model.create).not.toHaveBeenCalled();
  });

  it('throws a conflict when the scheduled insert returns nothing', async () => {
    deps.model.create.mockResolvedValue([]);

    await expect(
      deps.service.pay(CUSTOMER_ID, BILL_ID, payRequest({ scheduledFor: '2026-08-10' })),
    ).rejects.toThrow(ConflictError);
  });
});
