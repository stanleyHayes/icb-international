import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/domain.error.js';
import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AutopayService } from '../autopay.service.js';
import type { BillPaymentsService } from '../bill-payments.service.js';
import type { BillSettlementService } from '../bill-settlement.service.js';
import type { BillsService, OwnedBill } from '../bills.service.js';
import { ACCOUNT_ID, BILL_ID, CUSTOMER_ID, NOW, PAYMENT_ID, billPaymentDoc, billerDoc, linkedBillDoc } from './fixtures.js';

function owned(overrides: Record<string, unknown> = {}): OwnedBill {
  return { bill: linkedBillDoc(overrides), biller: billerDoc() };
}

function setup() {
  const bills = {
    loadOwned: vi.fn(),
    findDueAutopay: vi.fn().mockResolvedValue([]),
    markAutopayRun: vi.fn().mockResolvedValue(undefined),
  };
  const payments = {
    findDueScheduled: vi.fn().mockResolvedValue([]),
    markFailed: vi.fn().mockResolvedValue(undefined),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
  };
  const settlement = { execute: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new AutopayService(
    bills as unknown as BillsService,
    payments as unknown as BillPaymentsService,
    settlement as unknown as BillSettlementService,
    clock,
  );
  return { service, bills, payments, settlement };
}

describe('AutopayService.runDueAutopay — scheduled payments', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('reports a zeroed sweep when nothing is due', async () => {
    const result = await deps.service.runDueAutopay();

    expect(result).toEqual({
      scheduledAttempted: 0,
      autopayAttempted: 0,
      paid: 0,
      failed: 0,
      skipped: 0,
    });
    expect(deps.payments.findDueScheduled).toHaveBeenCalledWith(NOW);
    expect(deps.bills.findDueAutopay).toHaveBeenCalledWith('2026-09-03');
  });

  it('runs a due scheduled payment through settlement with its record id', async () => {
    const scheduled = billPaymentDoc({ status: 'scheduled', scheduledFor: NOW });
    deps.payments.findDueScheduled.mockResolvedValue([scheduled]);
    deps.bills.loadOwned.mockResolvedValue(owned());
    deps.settlement.execute.mockResolvedValue(billPaymentDoc({ status: 'completed' }));

    const result = await deps.service.runDueAutopay();

    expect(deps.settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        fromAccountId: ACCOUNT_ID,
        amountMinorUnits: scheduled.amountMinorUnits,
        initiatedBy: 'customer',
        paymentId: PAYMENT_ID,
      }),
    );
    expect(result).toMatchObject({ scheduledAttempted: 1, paid: 1, failed: 0 });
  });

  it('normalises any non-autopay initiator to customer', async () => {
    deps.payments.findDueScheduled.mockResolvedValue([billPaymentDoc({ initiatedBy: 'staff' })]);
    deps.bills.loadOwned.mockResolvedValue(owned());
    deps.settlement.execute.mockResolvedValue(billPaymentDoc());

    await deps.service.runDueAutopay();

    expect(deps.settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({ initiatedBy: 'customer' }),
    );
  });

  it('counts a biller-rejected settlement as failed without re-marking the record', async () => {
    deps.payments.findDueScheduled.mockResolvedValue([billPaymentDoc()]);
    deps.bills.loadOwned.mockResolvedValue(owned());
    deps.settlement.execute.mockResolvedValue(billPaymentDoc({ failureReason: 'The biller said no' }));

    const result = await deps.service.runDueAutopay();

    expect(result.failed).toBe(1);
    expect(deps.payments.markFailed).not.toHaveBeenCalled();
  });

  it('marks the payment failed with the domain message when the bill can no longer be loaded', async () => {
    deps.payments.findDueScheduled.mockResolvedValue([billPaymentDoc()]);
    deps.bills.loadOwned.mockRejectedValue(new NotFoundError('Bill', BILL_ID));

    const result = await deps.service.runDueAutopay();

    expect(deps.payments.markFailed).toHaveBeenCalledWith(
      PAYMENT_ID,
      expect.stringContaining('Bill'),
    );
    expect(deps.settlement.execute).not.toHaveBeenCalled();
    expect(result.failed).toBe(1);
  });

  it('hides internals behind a generic reason for non-domain errors', async () => {
    deps.payments.findDueScheduled.mockResolvedValue([billPaymentDoc()]);
    deps.settlement.execute.mockRejectedValue(new Error('connection reset'));
    deps.bills.loadOwned.mockResolvedValue(owned());

    const result = await deps.service.runDueAutopay();

    expect(deps.payments.markFailed).toHaveBeenCalledWith(
      PAYMENT_ID,
      'The payment could not be completed',
    );
    expect(result.failed).toBe(1);
  });
});

describe('AutopayService.runDueAutopay — autopay rules', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('pays the outstanding balance when the trigger date has arrived', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ autopayEnabled: true, autopayFromAccountId: ACCOUNT_ID }),
    ]);
    deps.settlement.execute.mockResolvedValue(billPaymentDoc({ status: 'completed' }));

    const result = await deps.service.runDueAutopay();

    expect(deps.bills.markAutopayRun).toHaveBeenCalledWith(BILL_ID, '2026-08-05');
    expect(deps.settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        initiatedBy: 'autopay',
        fromAccountId: ACCOUNT_ID,
        amountMinorUnits: 18_500,
      }),
    );
    expect(result).toMatchObject({ autopayAttempted: 1, paid: 1 });
  });

  it('applies the customer cap to the amount paid', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ autopayFromAccountId: ACCOUNT_ID, autopayCapMinorUnits: 10_000 }),
    ]);
    deps.settlement.execute.mockResolvedValue(billPaymentDoc());

    await deps.service.runDueAutopay();

    expect(deps.settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinorUnits: 10_000 }),
    );
  });

  it('uses the fixed amount for a fixed-amount rule', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({
        autopayFromAccountId: ACCOUNT_ID,
        autopayStrategy: 'fixed_amount',
        autopayFixedMinorUnits: 5000,
      }),
    ]);
    deps.settlement.execute.mockResolvedValue(billPaymentDoc());

    await deps.service.runDueAutopay();

    expect(deps.settlement.execute).toHaveBeenCalledWith(
      expect.objectContaining({ amountMinorUnits: 5000 }),
    );
  });

  it('skips a rule already run for the current due date', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ autopayFromAccountId: ACCOUNT_ID, autopayLastDueOn: '2026-08-05' }),
    ]);

    const result = await deps.service.runDueAutopay();

    expect(result).toMatchObject({ autopayAttempted: 0, skipped: 1 });
    expect(deps.bills.markAutopayRun).not.toHaveBeenCalled();
    expect(deps.settlement.execute).not.toHaveBeenCalled();
  });

  it('skips a rule with no due date, no funding account, or nothing to pay', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ dueOn: null, autopayFromAccountId: ACCOUNT_ID }),
      owned({ autopayFromAccountId: null }),
      owned({ autopayFromAccountId: ACCOUNT_ID, outstandingMinorUnits: 0 }),
    ]);

    const result = await deps.service.runDueAutopay();

    expect(result).toMatchObject({ autopayAttempted: 0, skipped: 3 });
    expect(deps.settlement.execute).not.toHaveBeenCalled();
  });

  it('skips a rule whose trigger date is still ahead', async () => {
    // Due in 20 days with a 2-day lead: inside the 30-day horizon but not yet triggered.
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ autopayFromAccountId: ACCOUNT_ID, dueOn: '2026-08-24' }),
    ]);

    const result = await deps.service.runDueAutopay();

    expect(result).toMatchObject({ autopayAttempted: 0, skipped: 1 });
  });

  it('stamps the run before a failing attempt and records the failure itself', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ autopayFromAccountId: ACCOUNT_ID }),
    ]);
    deps.settlement.execute.mockRejectedValue(
      new DomainError('ACCOUNT_FROZEN', 'This account is frozen and cannot be used'),
    );

    const result = await deps.service.runDueAutopay();

    expect(deps.bills.markAutopayRun).toHaveBeenCalledWith(BILL_ID, '2026-08-05');
    expect(deps.payments.recordFailedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ initiatedBy: 'autopay' }),
      'This account is frozen and cannot be used',
    );
    expect(result).toMatchObject({ autopayAttempted: 1, failed: 1 });
  });

  it('keeps the sweep going after one rule fails', async () => {
    deps.bills.findDueAutopay.mockResolvedValue([
      owned({ autopayFromAccountId: ACCOUNT_ID }),
      owned({ _id: 'bill-2', autopayFromAccountId: ACCOUNT_ID }),
    ]);
    deps.settlement.execute
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(billPaymentDoc({ status: 'completed' }));

    const result = await deps.service.runDueAutopay();

    expect(result).toMatchObject({ autopayAttempted: 2, paid: 1, failed: 1 });
  });
});
