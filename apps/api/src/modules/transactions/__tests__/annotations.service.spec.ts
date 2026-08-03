import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normaliseTags, TransactionAnnotationsService } from '../annotations.service.js';
import type { TransactionAnnotationDoc } from '../infrastructure/transaction-annotation.schemas.js';

function doc(overrides: Partial<TransactionAnnotationDoc> = {}): TransactionAnnotationDoc {
  return {
    _id: '01JANN00000000000000000001',
    customerId: 'cust-1',
    transactionId: 'txn-1',
    note: null,
    tags: [],
    category: null,
    attachments: [],
    ...overrides,
  };
}

/** A chainable stand-in for the Mongoose query (`find().lean()`, `findOneAndUpdate().lean()`). */
function modelDouble() {
  return {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };
}

describe('TransactionAnnotationsService', () => {
  let model: ReturnType<typeof modelDouble>;
  let service: TransactionAnnotationsService;

  beforeEach(() => {
    model = modelDouble();
    service = new TransactionAnnotationsService(
      model as unknown as Model<TransactionAnnotationDoc>,
    );
  });

  it('loads annotations for a page in one query, keyed by transaction id', async () => {
    const rows = [doc({ transactionId: 'txn-1' }), doc({ transactionId: 'txn-2', note: 'hi' })];
    model.find.mockReturnValue({ lean: () => Promise.resolve(rows) });

    const result = await service.getForTransactions('cust-1', ['txn-1', 'txn-2']);

    expect(model.find).toHaveBeenCalledWith({ customerId: 'cust-1', transactionId: { $in: ['txn-1', 'txn-2'] } });
    expect(result.get('txn-2')?.note).toBe('hi');
    expect(result.size).toBe(2);
  });

  it('returns an empty map for an empty id list without touching the database', async () => {
    const result = await service.getForTransactions('cust-1', []);

    expect(result.size).toBe(0);
    expect(model.find).not.toHaveBeenCalled();
  });

  it('upserts only the fields present in the patch', async () => {
    model.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(doc({ note: 'rent' })) });

    await service.upsert('cust-1', 'txn-1', { note: 'rent' });

    const [, update] = model.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown>; $setOnInsert: Record<string, unknown> },
    ];
    expect(update.$set).toEqual({ note: 'rent' });
    expect(update.$set).not.toHaveProperty('tags');
    expect(update.$set).not.toHaveProperty('category');
    expect(update.$setOnInsert).toMatchObject({ customerId: 'cust-1', transactionId: 'txn-1' });
  });

  it('clears the note when the patch carries null', async () => {
    model.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(doc()) });

    await service.upsert('cust-1', 'txn-1', { note: null });

    const [, update] = model.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set['note']).toBeNull();
  });

  it('normalises tags on write', async () => {
    model.findOneAndUpdate.mockReturnValue({
      lean: () => Promise.resolve(doc({ tags: ['home', 'rent'] })),
    });

    await service.upsert('cust-1', 'txn-1', { tags: [' home ', 'rent', 'home', '  '] });

    const [, update] = model.findOneAndUpdate.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set['tags']).toEqual(['home', 'rent']);
  });

  it('scopes every read to the owning customer', async () => {
    model.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const result = await service.getForTransaction('cust-2', 'txn-1');

    expect(model.findOne).toHaveBeenCalledWith({ customerId: 'cust-2', transactionId: 'txn-1' });
    expect(result).toBeNull();
  });
});

describe('normaliseTags', () => {
  it('trims, drops empties, and de-duplicates keeping first occurrence', () => {
    expect(normaliseTags([' a ', 'b', 'a', ' ', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty list for an empty input', () => {
    expect(normaliseTags([])).toEqual([]);
  });
});
