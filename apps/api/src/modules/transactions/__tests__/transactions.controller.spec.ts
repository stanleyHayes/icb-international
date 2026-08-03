import type { DownloadLink, TransactionDetail } from '@icb/contracts';
import type { FastifyReply } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import type { ClockService } from '../../../simulation/clock/clock.service.js';
import type { TransactionAnalyticsService } from '../analytics.service.js';
import type { TransactionExportsService } from '../exports.service.js';
import { TransactionsController } from '../transactions.controller.js';
import type { TransactionsService } from '../transactions.service.js';

const LINK: DownloadLink = {
  url: 'http://localhost:3000/v1/transactions/exports/exp-1/download',
  expiresAt: '2026-02-01T00:05:00.000Z',
  filename: 'transactions-0011223344-2026-01-01-2026-01-31.csv',
};

/** Enough of a detail for the receipt renderer — every field it reads. */
const DETAIL = {
  id: 'txn-1',
  accountId: 'acct-1',
  reference: 'TRF-2026-0001',
  type: 'card_purchase',
  status: 'settled',
  direction: 'debit',
  amount: { minorUnits: 4_250, currency: 'USD', scale: 2 },
  description: 'Palm Grove Supermarket',
  category: 'groceries',
  merchant: null,
  bookedAt: '2026-01-15T10:30:00.000Z',
  valueDate: '2026-01-15',
  pending: false,
  note: null,
} as unknown as TransactionDetail;

function replyDouble() {
  const reply = {
    header: vi.fn(),
    send: vi.fn(),
  };
  reply.header.mockReturnValue(reply);
  reply.send.mockResolvedValue(reply);
  return reply;
}

describe('TransactionsController', () => {
  let transactions: { list: ReturnType<typeof vi.fn>; detail: ReturnType<typeof vi.fn>; annotate: ReturnType<typeof vi.fn> };
  let analytics: { spendByCategory: ReturnType<typeof vi.fn>; cashflow: ReturnType<typeof vi.fn> };
  let exports: { request: ReturnType<typeof vi.fn>; renderDownload: ReturnType<typeof vi.fn> };
  let controller: TransactionsController;

  beforeEach(() => {
    transactions = {
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
      detail: vi.fn().mockResolvedValue(DETAIL),
      annotate: vi.fn().mockResolvedValue(DETAIL),
    };
    analytics = {
      spendByCategory: vi.fn().mockResolvedValue({ categories: [] }),
      cashflow: vi.fn().mockResolvedValue({ points: [] }),
    };
    exports = {
      request: vi.fn().mockResolvedValue(LINK),
      renderDownload: vi.fn().mockResolvedValue({
        bytes: Buffer.from('a,b\n'),
        contentType: 'text/csv; charset=utf-8',
        filename: LINK.filename,
      }),
    };

    controller = new TransactionsController(
      transactions as unknown as TransactionsService,
      analytics as unknown as TransactionAnalyticsService,
      exports as unknown as TransactionExportsService,
      { now: () => new Date('2026-02-01T00:00:00.000Z') } as unknown as ClockService,
      { bank: { name: 'ICB Bank' } } as unknown as AppConfiguration,
    );
  });

  it('delegates list queries to the service with the token customer', async () => {
    const page = await controller.list('cust-1', { limit: 25, includePending: true });

    expect(transactions.list).toHaveBeenCalledWith('cust-1', { limit: 25, includePending: true });
    expect(page.hasMore).toBe(false);
  });

  it('delegates annotate and returns the refreshed detail', async () => {
    await controller.annotate('cust-1', 'txn-1', { note: 'rent', tags: ['home'] });

    expect(transactions.annotate).toHaveBeenCalledWith('cust-1', 'txn-1', {
      note: 'rent',
      tags: ['home'],
    });
  });

  it('requests an export and answers with the download link', async () => {
    const body = { accountId: 'acct-1', format: 'csv' as const, from: '2026-01-01', to: '2026-01-31' };

    const link = await controller.requestExport('cust-1', body);

    expect(exports.request).toHaveBeenCalledWith('cust-1', body);
    expect(link.filename).toBe(LINK.filename);
  });

  it('streams export bytes with content type and disposition headers', async () => {
    const reply = replyDouble();

    await controller.downloadExport('cust-1', 'exp-1', reply as unknown as FastifyReply);

    expect(exports.renderDownload).toHaveBeenCalledWith('cust-1', 'exp-1');
    expect(reply.header).toHaveBeenCalledWith('content-type', 'text/csv; charset=utf-8');
    expect(reply.header).toHaveBeenCalledWith(
      'content-disposition',
      `attachment; filename="${LINK.filename}"`,
    );
    expect(reply.send).toHaveBeenCalledOnce();
  });

  it('renders the receipt as HTML for the owning customer', async () => {
    const reply = replyDouble();

    await controller.receipt('cust-1', 'txn-1', reply as unknown as FastifyReply);

    expect(transactions.detail).toHaveBeenCalledWith('cust-1', 'txn-1');
    expect(reply.header).toHaveBeenCalledWith('content-type', 'text/html; charset=utf-8');
    expect(reply.send).toHaveBeenCalledOnce();
  });

  it('routes analytics queries to the analytics service', async () => {
    await controller.spendByCategory('cust-1', { currency: 'USD' });
    await controller.cashflow('cust-1', { currency: 'USD', granularity: 'month' });

    expect(analytics.spendByCategory).toHaveBeenCalledWith('cust-1', { currency: 'USD' });
    expect(analytics.cashflow).toHaveBeenCalledWith('cust-1', {
      currency: 'USD',
      granularity: 'month',
    });
  });
});
