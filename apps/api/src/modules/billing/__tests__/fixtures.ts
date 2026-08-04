import { vi } from 'vitest';

import type { PayBillCommand } from '../domain/pay-bill.command.js';
import type { BillPaymentDoc } from '../infrastructure/bill-payment.schemas.js';
import type { LinkedBillDoc } from '../infrastructure/bill.schemas.js';
import type { BillerDoc } from '../infrastructure/biller.schemas.js';

export const NOW = new Date('2026-08-04T10:00:00.000Z');
export const TODAY = '2026-08-04';
/** The `YYYY-MM` cycle `TODAY` falls in — what `BillsService` enquires against. */
export const CYCLE = TODAY.slice(0, 7);
/** A meter number that satisfies the fixture biller's `referencePattern`. */
export const METER_REFERENCE = '1234567890';
export const CUSTOMER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9C1';
export const ACCOUNT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9A1';
export const BILLER_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9B1';
export const BILL_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9D1';
export const PAYMENT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9P1';
export const TRANSACTION_ID = 'txn-bill-1';
export const REVERSAL_TRANSACTION_ID = 'txn-bill-1-reversal';

/** A postpaid electricity biller with a balance enquiry, a minimum, and a fee. */
export function billerDoc(overrides: Record<string, unknown> = {}): BillerDoc {
  return {
    _id: BILLER_ID,
    code: 'NATIONAL_GRID_POSTPAID',
    name: 'National Grid Power — Postpaid',
    category: 'electricity',
    logoUrl: null,
    referenceLabel: 'Meter number',
    referencePattern: String.raw`^\d{10}$`,
    supportsBalanceEnquiry: true,
    minimumAmountMinorUnits: 500,
    feeMinorUnits: 100,
    failureRate: 0,
    typicalBillMinorUnits: 18_500,
    currency: 'GBP',
    active: true,
    ...overrides,
  };
}

/** A linked bill with an outstanding balance due tomorrow and no autopay run yet. */
export function linkedBillDoc(overrides: Record<string, unknown> = {}): LinkedBillDoc {
  return {
    _id: BILL_ID,
    customerId: CUSTOMER_ID,
    billerId: BILLER_ID,
    customerReference: METER_REFERENCE,
    nickname: null,
    currency: 'GBP',
    outstandingMinorUnits: 18_500,
    dueOn: '2026-08-05',
    enquiryCycle: CYCLE,
    enquiredAt: NOW,
    autopayEnabled: false,
    autopayFromAccountId: null,
    autopayStrategy: 'full_balance',
    autopayFixedMinorUnits: null,
    autopayDaysBeforeDue: 2,
    autopayCapMinorUnits: null,
    autopayLastDueOn: null,
    lastPaidAt: null,
    lastPaidMinorUnits: null,
    createdAt: NOW,
    ...overrides,
  };
}

/** A processing bill payment with a posted ledger transaction behind it. */
export function billPaymentDoc(overrides: Record<string, unknown> = {}): BillPaymentDoc {
  return {
    _id: PAYMENT_ID,
    customerId: CUSTOMER_ID,
    billId: BILL_ID,
    billerId: BILLER_ID,
    billerName: 'National Grid Power — Postpaid',
    customerReference: METER_REFERENCE,
    fromAccountId: ACCOUNT_ID,
    amountMinorUnits: 18_500,
    feeMinorUnits: 100,
    currency: 'GBP',
    status: 'processing',
    billerReference: null,
    failureReason: null,
    transactionId: TRANSACTION_ID,
    reversalTransactionId: null,
    scheduledFor: null,
    paidAt: null,
    valueDate: TODAY,
    initiatedBy: 'customer',
    createdAt: NOW,
    ...overrides,
  };
}

/** A customer-initiated pay command for the fixture bill and biller. */
export function payCommand(overrides: Record<string, unknown> = {}): PayBillCommand {
  return {
    customerId: CUSTOMER_ID,
    bill: linkedBillDoc(),
    biller: billerDoc(),
    fromAccountId: ACCOUNT_ID,
    amountMinorUnits: 18_500,
    initiatedBy: 'customer',
    ...overrides,
  };
}

type ChainMock = Record<string, ReturnType<typeof vi.fn>>;

/**
 * A Mongoose query stand-in: every chaining method returns the same object, `lean` resolves.
 * Models are mocked only here — the port boundary — never deeper into the module.
 */
export function chainQuery(result: unknown): ChainMock {
  const chain: ChainMock = {};
  for (const method of ['sort', 'select', 'limit', 'skip', 'session']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain['lean'] = vi.fn().mockResolvedValue(result);
  return chain;
}
