import type { TransactionDetail } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { renderReceiptHtml } from '../receipt-html.js';

function detail(overrides: Partial<TransactionDetail> = {}): TransactionDetail {
  return {
    id: 'txn-1',
    accountId: 'acct-1',
    reference: 'TRF-2026-0001',
    type: 'card_purchase',
    status: 'settled',
    direction: 'debit',
    amount: { minorUnits: 4_250, currency: 'USD', scale: 2 },
    runningBalance: { minorUnits: 95_750, currency: 'USD', scale: 2 },
    description: 'Palm Grove Supermarket',
    category: 'groceries',
    merchant: null,
    counterparty: null,
    bookedAt: '2026-01-15T10:30:00.000Z',
    valueDate: '2026-01-15',
    pending: false,
    postings: [],
    fees: [],
    fx: null,
    note: null,
    tags: [],
    attachmentCount: 0,
    relatedTransferId: null,
    relatedCardId: null,
    reversalOfId: null,
    reversedById: null,
    disputeId: null,
    metadata: undefined,
    settledAt: '2026-01-16T00:00:00.000Z',
    ...overrides,
  };
}

const GENERATED = new Date('2026-02-01T00:00:00.000Z');

describe('renderReceiptHtml', () => {
  it('renders a complete HTML document with the bank, amount, and reference', () => {
    const html = renderReceiptHtml({ bankName: 'ICB Bank', detail: detail(), generatedAt: GENERATED });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('ICB Bank');
    expect(html).toContain('Transaction receipt');
    expect(html).toContain('TRF-2026-0001');
    expect(html).toContain('Palm Grove Supermarket');
  });

  it('shows a negative amount for a debit and a positive one for a credit', () => {
    const debit = renderReceiptHtml({ bankName: 'B', detail: detail(), generatedAt: GENERATED });
    const credit = renderReceiptHtml({
      bankName: 'B',
      detail: detail({ direction: 'credit' }),
      generatedAt: GENERATED,
    });

    expect(debit).toContain('-$42.50');
    expect(credit).toContain('$42.50');
    expect(credit).not.toContain('-$42.50');
  });

  it('escapes HTML in every interpolated value', () => {
    const html = renderReceiptHtml({
      bankName: 'ICB <script>alert(1)</script>',
      detail: detail({ description: '<img src=x onerror=alert(1)>', note: '"><b>bold</b>' }),
      generatedAt: GENERATED,
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img src=x');
  });

  it('omits rows whose value is absent', () => {
    const html = renderReceiptHtml({ bankName: 'B', detail: detail(), generatedAt: GENERATED });

    expect(html).not.toContain('Merchant');
    expect(html).not.toContain('Note');
  });

  it('marks pending transactions as pending', () => {
    const html = renderReceiptHtml({
      bankName: 'B',
      detail: detail({ pending: true, status: 'authorised' }),
      generatedAt: GENERATED,
    });

    expect(html).toContain('Pending');
  });
});
