import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { BillSettlementService } from '../bill-settlement.service.js';
import { BillPaymentsService } from '../bill-payments.service.js';
import type { BillsService } from '../bills.service.js';
import type { PayBillCommand } from '../domain/pay-bill.command.js';
import type { BillPaymentDoc } from '../infrastructure/bill-payment.schemas.js';
import {
  ACCOUNT_ID,
  CUSTOMER_ID,
  NOW,
  PAYMENT_ID,
  TODAY,
  billPaymentDoc,
  billerDoc,
  chainQuery,
  linkedBillDoc,
} from './fixtures.js';

function setup(payment: BillPaymentDoc | null = billPaymentDoc()) {
  const model = {
    create: vi.fn().mockImplementation((docs: unknown[]) => Promise.resolve(docs)),
    find: vi.fn().mockReturnValue(chainQuery([])),
    findOne: vi.fn().mockReturnValue(chainQuery(payment)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const bills = { loadOwned: vi.fn() };
  const settlement = { execute: vi.fn() };
  const accounts = { loadSpendable: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BillPaymentsService(
    model as unknown as Model<BillPaymentDoc>,
    bills as unknown as BillsService,
    settlement as unknown as BillSettlementService,
    accounts as unknown as AccountsService,
    clock,
  );
  return { service, model };
}

function command(overrides: Partial<PayBillCommand> = {}): PayBillCommand {
  return {
    customerId: CUSTOMER_ID,
    bill: linkedBillDoc(),
    biller: billerDoc(),
    fromAccountId: ACCOUNT_ID,
    amountMinorUnits: 12_000,
    initiatedBy: 'autopay',
    ...overrides,
  };
}

describe('BillPaymentsService.list', () => {
  it('filters by customer and maps the page', async () => {
    const { service, model } = setup();
    model.find.mockReturnValue(chainQuery([billPaymentDoc()]));

    const result = await service.list(CUSTOMER_ID, { limit: 20 });

    expect(model.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(PAYMENT_ID);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it('builds one filter clause per supplied query parameter', async () => {
    const { service, model } = setup();

    await service.list(CUSTOMER_ID, {
      limit: 10,
      cursor: '01CURSOR',
      billId: 'b1',
      status: ['scheduled', 'failed'],
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(model.find).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      _id: { $lt: '01CURSOR' },
      billId: 'b1',
      status: { $in: ['scheduled', 'failed'] },
      valueDate: { $gte: '2026-08-01', $lte: '2026-08-31' },
    });
  });

  it('fetches one extra row and exposes the last id as the next cursor', async () => {
    const { service, model } = setup();
    const rows = [
      billPaymentDoc({ _id: 'p1' }),
      billPaymentDoc({ _id: 'p2' }),
      billPaymentDoc({ _id: 'p3' }),
    ];
    model.find.mockReturnValue(chainQuery(rows));

    const result = await service.list(CUSTOMER_ID, { limit: 2 });

    expect(result.items.map((item) => item.id)).toEqual(['p1', 'p2']);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('p2');
  });
});

describe('BillPaymentsService.getForCustomer', () => {
  it('returns the owned payment', async () => {
    const { service } = setup();

    const result = await service.getForCustomer(PAYMENT_ID, CUSTOMER_ID);

    expect(result.id).toBe(PAYMENT_ID);
    // Whatever is stored, unchanged — the reader does not advance a payment's status.
    expect(result.status).toBe('processing');
  });

  it('throws a typed not-found for a payment the customer does not own', async () => {
    const { service } = setup(null);

    await expect(service.getForCustomer(PAYMENT_ID, CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('BillPaymentsService.cancel', () => {
  it('cancels a scheduled payment', async () => {
    const { service, model } = setup(billPaymentDoc({ status: 'scheduled' }));

    const result = await service.cancel(PAYMENT_ID, CUSTOMER_ID);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_ID, customerId: CUSTOMER_ID },
      { $set: { status: 'cancelled' } },
    );
    expect(result.status).toBe('cancelled');
  });

  it('refuses to cancel a payment that has already moved money', async () => {
    const { service, model } = setup(billPaymentDoc({ status: 'completed' }));

    await expect(service.cancel(PAYMENT_ID, CUSTOMER_ID)).rejects.toThrow(ConflictError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('throws a typed not-found for an unknown payment', async () => {
    const { service } = setup(null);

    await expect(service.cancel(PAYMENT_ID, CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('BillPaymentsService.recordFailedAttempt', () => {
  it('records the refused attempt with today as the value date', async () => {
    const { service, model } = setup();

    await service.recordFailedAttempt(command(), 'Insufficient funds');

    expect(model.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customerId: CUSTOMER_ID,
          status: 'failed',
          failureReason: 'Insufficient funds',
          fromAccountId: ACCOUNT_ID,
          amountMinorUnits: 12_000,
          feeMinorUnits: 100,
          valueDate: TODAY,
          scheduledFor: null,
          transactionId: null,
          createdAt: NOW,
        }),
      ],
      { ordered: true },
    );
  });
});

describe('BillPaymentsService.markFailed', () => {
  it('fails only a payment still in scheduled state', async () => {
    const { service, model } = setup();

    await service.markFailed(PAYMENT_ID, 'Debit was refused');

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_ID, status: 'scheduled' },
      { $set: { status: 'failed', failureReason: 'Debit was refused' } },
    );
  });
});

describe('BillPaymentsService.findDueScheduled', () => {
  it('returns scheduled payments whose date has arrived, earliest first', async () => {
    const rows = [billPaymentDoc({ status: 'scheduled' })];
    const { service, model } = setup();
    model.find.mockReturnValue(chainQuery(rows));
    const asOf = new Date('2026-08-04T00:00:00.000Z');

    const result = await service.findDueScheduled(asOf);

    expect(model.find).toHaveBeenCalledWith({
      status: 'scheduled',
      scheduledFor: { $lte: asOf },
    });
    expect(result).toEqual(rows);
  });
});
