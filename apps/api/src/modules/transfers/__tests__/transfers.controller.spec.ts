import type { TransferDetail } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { BulkTransfersService } from '../application/bulk-transfers.service.js';
import type { TransferQuotesService } from '../application/transfer-quotes.service.js';
import { TransfersController } from '../transfers.controller.js';
import type { TransfersService } from '../transfers.service.js';

const CUSTOMER_ID = 'cust-1';
const TRANSFER_ID = 'trf-1';

const DETAIL = { id: TRANSFER_ID } as unknown as TransferDetail;

const USER: AccessTokenClaims = {
  sub: 'user-1',
  customerId: CUSTOMER_ID,
  email: 'ama@example.com',
  roles: ['customer'],
  sessionId: 'sess-1',
};

describe('TransfersController', () => {
  let transfers: Record<'create' | 'list' | 'get' | 'cancel', ReturnType<typeof vi.fn>>;
  let quotes: { issue: ReturnType<typeof vi.fn> };
  let bulk: { execute: ReturnType<typeof vi.fn> };
  let controller: TransfersController;

  beforeEach(() => {
    transfers = {
      create: vi.fn().mockResolvedValue(DETAIL),
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
      get: vi.fn().mockResolvedValue(DETAIL),
      cancel: vi.fn().mockResolvedValue(DETAIL),
    };
    quotes = { issue: vi.fn().mockResolvedValue({ id: 'quote-1' }) };
    bulk = { execute: vi.fn().mockResolvedValue({ batchId: 'batch-1', items: [] }) };

    controller = new TransfersController(
      transfers as unknown as TransfersService,
      quotes as unknown as TransferQuotesService,
      bulk as unknown as BulkTransfersService,
    );
  });

  it('issues a quote for the token customer', async () => {
    const body = { fromAccountId: 'acct-1', amount: { minorUnits: 5_000 } };

    const result = await controller.quote(CUSTOMER_ID, body as never);

    expect(quotes.issue).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toEqual({ id: 'quote-1' });
  });

  it('executes a bulk transfer batch', async () => {
    const body = { fromAccountId: 'acct-1', items: [] };

    const result = await controller.createBulk(CUSTOMER_ID, body as never);

    expect(bulk.execute).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toEqual({ batchId: 'batch-1', items: [] });
  });

  it('creates a transfer with the step-up proof bound to the principal', async () => {
    const body = { quoteId: 'quote-1' };

    const result = await controller.create(CUSTOMER_ID, USER, 'step-up-token', body as never);

    expect(transfers.create).toHaveBeenCalledWith(CUSTOMER_ID, body, {
      userId: 'user-1',
      token: 'step-up-token',
    });
    expect(result).toBe(DETAIL);
  });

  it('creates a transfer with no step-up token when none is sent', async () => {
    const body = { quoteId: 'quote-1' };

    await controller.create(CUSTOMER_ID, USER, undefined, body as never);

    expect(transfers.create).toHaveBeenCalledWith(CUSTOMER_ID, body, {
      userId: 'user-1',
      token: undefined,
    });
  });

  it('lists transfers with the parsed query', async () => {
    const query = { limit: 20 };

    const page = await controller.list(CUSTOMER_ID, query);

    expect(transfers.list).toHaveBeenCalledWith(CUSTOMER_ID, query);
    expect(page.hasMore).toBe(false);
  });

  it('reads a transfer scoped by the token customer', async () => {
    const result = await controller.detail(CUSTOMER_ID, TRANSFER_ID);

    expect(transfers.get).toHaveBeenCalledWith(CUSTOMER_ID, TRANSFER_ID);
    expect(result).toBe(DETAIL);
  });

  it('cancels a transfer with the parsed reason', async () => {
    const result = await controller.cancel(CUSTOMER_ID, TRANSFER_ID, { reason: 'Mistake' });

    expect(transfers.cancel).toHaveBeenCalledWith(CUSTOMER_ID, TRANSFER_ID, 'Mistake');
    expect(result).toBe(DETAIL);
  });
});
