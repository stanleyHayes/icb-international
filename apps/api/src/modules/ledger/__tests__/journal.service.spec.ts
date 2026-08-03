import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { encodeCursor } from '../../../common/pagination/cursor.js';
import type { LedgerEntryDoc, LedgerTransactionDoc } from '../infrastructure/ledger.schemas.js';
import type { JournalQuery } from '../journal/journal.schemas.js';
import { JournalService } from '../journal/journal.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function transactionRow(overrides: Partial<LedgerTransactionDoc> = {}): LedgerTransactionDoc {
  return {
    _id: '01JTEST0000000000000000A',
    reference: 'TXN-2026-000001',
    type: 'deposit',
    status: 'posted',
    description: 'Opening deposit',
    actor: { kind: 'system', id: null, label: 'seed' },
    valueDate: '2026-08-02',
    bookedAt: NOW,
    settledAt: null,
    reversesTransactionId: null,
    reversedByTransactionId: null,
    sourceType: null,
    sourceId: null,
    correlationId: null,
    metadata: {},
    ...overrides,
  };
}

function entryRow(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: '01JENTRY000000000000000A',
    transactionId: '01JTEST0000000000000000A',
    accountRef: 'gl:1000',
    direction: 'debit',
    minorUnits: 10_000,
    currency: 'USD',
    signedMinorUnits: 10_000,
    valueDate: '2026-08-02',
    bookedAt: NOW,
    sequence: 0,
    narrative: null,
    transactionType: 'deposit',
    transactionStatus: 'posted',
    ...overrides,
  };
}

/** A thenable query chain ending at `lean()`, mirroring how the service consumes Mongoose. */
function queryChain<T>(result: T) {
  return {
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function setup({
  transactions = [] as LedgerTransactionDoc[],
  entries = [] as LedgerEntryDoc[],
} = {}) {
  const transactionsChain = queryChain(transactions);
  const entriesChain = queryChain(entries);
  const transactionsModel = {
    find: vi.fn().mockReturnValue(transactionsChain),
    findById: vi.fn(),
  };
  const entriesModel = {
    find: vi.fn().mockReturnValue(entriesChain),
    distinct: vi.fn().mockResolvedValue([]),
  };
  const service = new JournalService(
    transactionsModel as unknown as Model<LedgerTransactionDoc>,
    entriesModel as unknown as Model<LedgerEntryDoc>,
  );
  return { service, transactionsModel, entriesModel, transactionsChain };
}

const unfiltered: JournalQuery = { limit: 25 };

describe('JournalService.query', () => {
  it('pages newest-first with each transaction carrying its entries', async () => {
    const { service, transactionsModel, transactionsChain } = setup({
      transactions: [transactionRow()],
      entries: [entryRow()],
    });

    const page = await service.query(unfiltered);

    expect(transactionsModel.find).toHaveBeenCalledWith({});
    expect(transactionsChain.sort).toHaveBeenCalledWith({ _id: -1 });
    expect(transactionsChain.limit).toHaveBeenCalledWith(26);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(1);

    const [item] = page.items;
    expect(item?.transactionId).toBe('01JTEST0000000000000000A');
    expect(item?.bookedAt).toBe(NOW.toISOString());
    expect(item?.entries).toHaveLength(1);
    expect(item?.entries[0]?.amount).toEqual({ minorUnits: 10_000, currency: 'USD', scale: 2 });
  });

  it('fetches one lookahead row and emits a resume cursor when more remain', async () => {
    const rows = ['01JB', '01JA', '01J9'].map((id) => transactionRow({ _id: id }));
    const { service } = setup({ transactions: rows });

    const page = await service.query({ limit: 2 });

    expect(page.items.map((item) => item.transactionId)).toEqual(['01JB', '01JA']);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe(encodeCursor('01JA'));
  });

  it('applies the cursor as an exclusive upper bound on the id', async () => {
    const { service, transactionsModel } = setup();

    await service.query({ limit: 25, cursor: encodeCursor('01JPREV000000000000000Z') });

    expect(transactionsModel.find).toHaveBeenCalledWith({
      _id: { $lt: '01JPREV000000000000000Z' },
    });
  });

  it('rejects a malformed cursor with a typed validation error', async () => {
    const { service } = setup();

    await expect(service.query({ limit: 25, cursor: 'not-a-cursor' })).rejects.toThrow(
      DomainError,
    );
    await expect(service.query({ limit: 25, cursor: 'not-a-cursor' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('scopes to the transactions that touched an account reference', async () => {
    const { service, transactionsModel, entriesModel } = setup();
    entriesModel.distinct.mockResolvedValue(['01JT1', '01JT2']);

    await service.query({ limit: 25, accountRef: 'acct:01JACC' });

    expect(entriesModel.distinct).toHaveBeenCalledWith('transactionId', {
      accountRef: 'acct:01JACC',
    });
    expect(transactionsModel.find).toHaveBeenCalledWith({ _id: { $in: ['01JT1', '01JT2'] } });
  });

  it('combines account scoping, currency scoping, and a cursor in one id filter', async () => {
    const { service, transactionsModel, entriesModel } = setup();
    entriesModel.distinct.mockResolvedValue(['01JT1']);

    await service.query({
      limit: 25,
      accountRef: 'gl:2000',
      currency: 'USD',
      cursor: encodeCursor('01JPREV'),
    });

    expect(entriesModel.distinct).toHaveBeenCalledWith('transactionId', {
      accountRef: 'gl:2000',
      currency: 'USD',
    });
    expect(transactionsModel.find).toHaveBeenCalledWith({
      _id: { $lt: '01JPREV', $in: ['01JT1'] },
    });
  });

  it('applies reference, type, status, and value-date filters', async () => {
    const { service, transactionsModel } = setup();

    await service.query({
      limit: 25,
      reference: 'TXN-2026-000001',
      type: 'deposit',
      status: 'posted',
      from: '2026-08-01',
      to: '2026-08-02',
    });

    expect(transactionsModel.find).toHaveBeenCalledWith({
      reference: 'TXN-2026-000001',
      type: 'deposit',
      status: 'posted',
      valueDate: { $gte: '2026-08-01', $lte: '2026-08-02' },
    });
  });
});

describe('JournalService.detail', () => {
  it('returns the transaction with its entries in posting order', async () => {
    const { service, transactionsModel } = setup({ entries: [entryRow()] });
    transactionsModel.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(transactionRow()) });

    const detail = await service.detail('01JTEST0000000000000000A');

    expect(detail.reference).toBe('TXN-2026-000001');
    expect(detail.entries).toHaveLength(1);
    expect(detail.entries[0]?.accountRef).toBe('gl:1000');
  });

  it('throws a typed not-found error for an unknown transaction', async () => {
    const { service, transactionsModel } = setup();
    transactionsModel.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(service.detail('01JMISSING')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
