import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { CardReader } from '../application/card-reader.js';
import { type CardSpendService } from '../application/card-spend.service.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { cardDoc, chainQuery } from './fixtures.js';

function setup(rows: CardDoc[]) {
  const model = { find: vi.fn().mockReturnValue(chainQuery(rows)) };
  const spend = { windowFor: vi.fn(), toSpendDto: vi.fn() };
  const reader = new CardReader(
    model as unknown as Model<CardDoc>,
    spend as unknown as CardSpendService,
  );
  return { reader, model };
}

describe('CardReader.listAll', () => {
  it('queries without a customer scope and applies the optional filters', async () => {
    const { reader, model } = setup([cardDoc()]);

    await reader.listAll({ limit: 25 });

    expect(model.find).toHaveBeenCalledWith({});
  });

  it('passes account, status, kind and cursor filters straight into the query', async () => {
    const { reader, model } = setup([cardDoc()]);

    await reader.listAll({
      limit: 10,
      accountId: 'acct-1',
      status: ['active', 'frozen'],
      kind: ['debit'],
      cursor: 'cur-1',
    });

    expect(model.find).toHaveBeenCalledWith({
      accountId: 'acct-1',
      status: { $in: ['active', 'frozen'] },
      kind: { $in: ['debit'] },
      _id: { $lt: 'cur-1' },
    });
  });

  it('maps rows to summaries and trims the lookahead row into a cursor', async () => {
    const rows = [
      cardDoc({ _id: 'card-3' }),
      cardDoc({ _id: 'card-2' }),
      cardDoc({ _id: 'card-1' }),
    ];
    const { reader } = setup(rows);

    const page = await reader.listAll({ limit: 2 });

    expect(page.items.map((item) => item.id)).toEqual(['card-3', 'card-2']);
    expect(page.items[0]?.panLast4).toBe('4242');
    expect(page.nextCursor).toBe('card-2');
    expect(page.hasMore).toBe(true);
  });

  it('returns a closed page when the lookahead row is absent', async () => {
    const { reader } = setup([cardDoc({ _id: 'card-1' })]);

    const page = await reader.listAll({ limit: 25 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });
});

describe('CardReader.list', () => {
  it('keeps the customer scope on the customer-facing path', async () => {
    const { reader, model } = setup([cardDoc()]);

    await reader.list('cust-1', { limit: 25 });

    expect(model.find).toHaveBeenCalledWith({ customerId: 'cust-1' });
  });
});
