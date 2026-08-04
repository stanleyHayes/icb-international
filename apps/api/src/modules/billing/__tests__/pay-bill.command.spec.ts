import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import {
  BILL_PAYMENT_SOURCE,
  PAYMENT_STATUS,
  actorFor,
  billCurrency,
  buildPaymentLines,
  buildPostingCommand,
  feeFor,
  paymentInsertDefaults,
} from '../domain/pay-bill.command.js';
import { ACCOUNT_ID, BILL_ID, BILLER_ID, CUSTOMER_ID, NOW, billerDoc, payCommand } from './fixtures.js';

describe('PAYMENT_STATUS', () => {
  it('pins the lifecycle strings', () => {
    expect(PAYMENT_STATUS).toEqual({
      scheduled: 'scheduled',
      processing: 'processing',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
    });
  });
});

describe('billCurrency and feeFor', () => {
  it('reads the currency off the biller and prices the fee in it', () => {
    expect(billCurrency(billerDoc())).toBe('GBP');
    expect(feeFor(billerDoc())).toEqual(fromMinorUnits(100, 'GBP'));
  });
});

describe('actorFor', () => {
  it('credits the system for an autopay debit', () => {
    expect(actorFor(payCommand({ initiatedBy: 'autopay' }))).toEqual({
      kind: 'system',
      id: null,
      label: 'Autopay',
    });
  });

  it('credits the customer for a manual payment', () => {
    expect(actorFor(payCommand())).toEqual({
      kind: 'customer',
      id: CUSTOMER_ID,
      label: '1234567890',
    });
  });
});

describe('buildPaymentLines', () => {
  it('posts a debit/credit pair through pending settlement when there is no fee', () => {
    const lines = buildPaymentLines({
      accountId: ACCOUNT_ID,
      amount: fromMinorUnits(18_500, 'GBP'),
      fee: fromMinorUnits(0, 'GBP'),
      billerName: 'National Grid Power — Postpaid',
      customerReference: '1234567890',
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      accountRef: `acct:${ACCOUNT_ID}`,
      direction: 'debit',
      narrative: 'Bill payment to National Grid Power — Postpaid (1234567890)',
    });
    expect(lines[0]?.amount.minorUnits).toBe(18_500);
    expect(lines[1]).toMatchObject({ accountRef: 'gl:2100', direction: 'credit' });
  });

  it('adds a fee pair to fee income on the same transaction', () => {
    const lines = buildPaymentLines({
      accountId: ACCOUNT_ID,
      amount: fromMinorUnits(18_500, 'GBP'),
      fee: fromMinorUnits(100, 'GBP'),
      billerName: 'National Grid Power — Postpaid',
      customerReference: '1234567890',
    });

    expect(lines).toHaveLength(4);
    expect(lines[2]).toMatchObject({
      accountRef: `acct:${ACCOUNT_ID}`,
      direction: 'debit',
      narrative: 'Bill payment fee — National Grid Power — Postpaid',
    });
    expect(lines[2]?.amount.minorUnits).toBe(100);
    expect(lines[3]).toMatchObject({ accountRef: 'gl:4000', direction: 'credit' });
  });
});

describe('buildPostingCommand', () => {
  it('assembles a transfer_out linked back to the payment', () => {
    const posting = buildPostingCommand({
      command: payCommand(),
      amount: fromMinorUnits(18_500, 'GBP'),
      fee: fromMinorUnits(100, 'GBP'),
      paymentId: 'payment-1',
    });

    expect(posting.type).toBe('transfer_out');
    expect(posting.description).toBe('Bill payment to National Grid Power — Postpaid');
    expect(posting.sourceType).toBe(BILL_PAYMENT_SOURCE);
    expect(posting.sourceId).toBe('payment-1');
    expect(posting.metadata).toEqual({ billerCode: 'NATIONAL_GRID_POSTPAID', billId: BILL_ID });
    expect(posting.lines).toHaveLength(4);
  });
});

describe('paymentInsertDefaults', () => {
  it('fixes the immutable fields of a new payment record', () => {
    const defaults = paymentInsertDefaults(payCommand(), {
      now: NOW,
      valueDate: '2026-08-04',
      scheduledFor: null,
    });

    expect(defaults).toEqual({
      customerId: CUSTOMER_ID,
      billId: BILL_ID,
      billerId: BILLER_ID,
      billerName: 'National Grid Power — Postpaid',
      customerReference: '1234567890',
      currency: 'GBP',
      initiatedBy: 'customer',
      valueDate: '2026-08-04',
      scheduledFor: null,
      createdAt: NOW,
      billerReference: null,
      failureReason: null,
      reversalTransactionId: null,
      paidAt: null,
    });
  });
});
