import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ConflictError, InsufficientFundsError } from '../../../common/errors/index.js';
import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import { BillSettlementService } from '../bill-settlement.service.js';
import type { BillsService } from '../bills.service.js';
import type { BillPaymentDoc } from '../infrastructure/bill-payment.schemas.js';
import {
  ACCOUNT_ID,
  NOW,
  PAYMENT_ID,
  REVERSAL_TRANSACTION_ID,
  TODAY,
  TRANSACTION_ID,
  billPaymentDoc,
  billerDoc,
  chainQuery,
  linkedBillDoc,
  payCommand,
} from './fixtures.js';

const SESSION = { id: 'session-1' };

function setup(overrides: { availableMinorUnits?: number; accountCurrency?: string } = {}) {
  const stored = billPaymentDoc();
  const payments = {
    create: vi.fn().mockResolvedValue([stored]),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    findById: vi.fn().mockReturnValue(chainQuery(stored)),
  };
  const bills = { recordPayment: vi.fn().mockResolvedValue(undefined) };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({
      _id: ACCOUNT_ID,
      currency: overrides.accountCurrency ?? 'GBP',
    }),
    balancesFor: vi.fn().mockResolvedValue({
      ledger: fromMinorUnits(overrides.availableMinorUnits ?? 100_000, 'GBP'),
      holds: fromMinorUnits(0, 'GBP'),
      available: fromMinorUnits(overrides.availableMinorUnits ?? 100_000, 'GBP'),
    }),
  };
  const ledger = {
    postWithin: vi.fn().mockResolvedValue({ id: TRANSACTION_ID }),
    markSettled: vi.fn().mockResolvedValue(undefined),
    reverse: vi.fn().mockResolvedValue({ id: REVERSAL_TRANSACTION_ID }),
  };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: unknown) => unknown) =>
      Promise.resolve(work(SESSION)),
    ),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new BillSettlementService(
    payments as unknown as Model<BillPaymentDoc>,
    bills as unknown as BillsService,
    accounts as unknown as AccountsService,
    ledger as unknown as LedgerService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, payments, bills, accounts, ledger, transactionManager, stored };
}

describe('BillSettlementService.execute — debit guards', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('refuses a funding account in another currency before any posting', async () => {
    deps = setup({ accountCurrency: 'USD' });

    await expect(deps.service.execute(payCommand())).rejects.toThrow(
      expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as DomainError,
    );
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
    expect(deps.payments.create).not.toHaveBeenCalled();
  });

  it('refuses a payment the available balance cannot cover', async () => {
    deps = setup({ availableMinorUnits: 18_000 });

    await expect(deps.service.execute(payCommand())).rejects.toThrow(InsufficientFundsError);
    expect(deps.transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('counts the fee towards affordability', async () => {
    // The amount alone fits exactly; the 100-unit fee tips it over.
    deps = setup({ availableMinorUnits: 18_500 });

    await expect(deps.service.execute(payCommand())).rejects.toThrow(InsufficientFundsError);
  });

  it('propagates a spendable-account rejection', async () => {
    deps.accounts.loadSpendable.mockRejectedValue(
      new DomainError('ACCOUNT_FROZEN', 'This account is frozen and cannot be used'),
    );

    await expect(deps.service.execute(payCommand())).rejects.toThrow(DomainError);
    expect(deps.ledger.postWithin).not.toHaveBeenCalled();
  });
});

describe('BillSettlementService.execute — posting and completion', () => {
  it('posts within a transaction, inserts a processing record, then settles it', async () => {
    const deps = setup();

    const result = await deps.service.execute(payCommand());

    expect(deps.transactionManager.withTransaction).toHaveBeenCalledOnce();
    expect(deps.ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transfer_out',
        sourceType: 'bill_payment',
        metadata: { billerCode: 'NATIONAL_GRID_POSTPAID', billId: deps.stored.billId },
      }),
      SESSION,
    );
    // New record: written with the frozen clock, not wall time.
    expect(deps.payments.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          status: 'processing',
          transactionId: TRANSACTION_ID,
          amountMinorUnits: 18_500,
          feeMinorUnits: 100,
          valueDate: TODAY,
          createdAt: NOW,
        }),
      ],
      { session: SESSION, ordered: true },
    );
    expect(deps.ledger.markSettled).toHaveBeenCalledWith(TRANSACTION_ID);
    expect(deps.payments.updateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_ID },
      {
        $set: expect.objectContaining({
          status: 'completed',
          paidAt: NOW,
          failureReason: null,
        }),
      },
    );
    expect(deps.bills.recordPayment).toHaveBeenCalledWith(linkedBillDoc(), 18_500, NOW);
    expect(result.status).toBe('completed');
    expect(result.billerReference).toMatch(/^NGP-/);
  });

  it('skips settlement when the record has no transaction behind it', async () => {
    const deps = setup();
    deps.payments.create.mockResolvedValue([billPaymentDoc({ transactionId: null })]);

    await deps.service.execute(payCommand());

    expect(deps.ledger.markSettled).not.toHaveBeenCalled();
  });

  it('throws a conflict when the insert writes nothing', async () => {
    const deps = setup();
    deps.payments.create.mockResolvedValue([undefined]);

    await expect(deps.service.execute(payCommand())).rejects.toThrow(ConflictError);
  });
});

describe('BillSettlementService.execute — scheduled payment reuse', () => {
  it('reuses the existing record and keeps its identifier', async () => {
    const deps = setup();

    await deps.service.execute(payCommand({ paymentId: PAYMENT_ID }));

    expect(deps.payments.create).not.toHaveBeenCalled();
    expect(deps.payments.updateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_ID },
      {
        $set: {
          status: 'processing',
          transactionId: TRANSACTION_ID,
          fromAccountId: ACCOUNT_ID,
          amountMinorUnits: 18_500,
          feeMinorUnits: 100,
        },
      },
      { session: SESSION },
    );
    expect(deps.payments.findById).toHaveBeenCalledWith(PAYMENT_ID);
  });

  it('throws a conflict when the scheduled record has gone', async () => {
    const deps = setup();
    deps.payments.findById.mockReturnValue(chainQuery(null));

    await expect(deps.service.execute(payCommand({ paymentId: PAYMENT_ID }))).rejects.toThrow(
      ConflictError,
    );
  });
});

describe('BillSettlementService.execute — biller rejection', () => {
  it('reverses the whole posting and records the failure', async () => {
    const deps = setup();
    const command = payCommand({ biller: billerDoc({ failureRate: 1 }) });

    const result = await deps.service.execute(command);

    expect(deps.ledger.reverse).toHaveBeenCalledWith(TRANSACTION_ID, expect.any(String), {
      kind: 'customer',
      id: command.customerId,
      label: '1234567890',
    });
    expect(deps.ledger.markSettled).not.toHaveBeenCalled();
    expect(deps.bills.recordPayment).not.toHaveBeenCalled();
    expect(deps.payments.updateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_ID },
      {
        $set: {
          status: 'failed',
          failureReason: expect.any(String) as string,
          reversalTransactionId: REVERSAL_TRANSACTION_ID,
          billerReference: null,
          paidAt: null,
        },
      },
    );
    expect(result.status).toBe('failed');
    expect(result.reversalTransactionId).toBe(REVERSAL_TRANSACTION_ID);
  });

  it('records a null reversal when there was no posting to reverse', async () => {
    const deps = setup();
    deps.payments.create.mockResolvedValue([billPaymentDoc({ transactionId: null })]);

    const result = await deps.service.execute(payCommand({ biller: billerDoc({ failureRate: 1 }) }));

    expect(deps.ledger.reverse).not.toHaveBeenCalled();
    expect(result.reversalTransactionId).toBeNull();
  });
});
