import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { CardReader } from '../application/card-reader.js';
import { type CardSpendService, type SpendWindow } from '../application/card-spend.service.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, CUSTOMER_ID, cardDoc, chainQuery } from './fixtures.js';

const WINDOW: SpendWindow = { todayMinorUnits: 0, monthMinorUnits: 0, atmTodayMinorUnits: 0 };
const SPEND_DTO = { todaySpent: null } as never;

function setup(card: CardDoc | null, rows: CardDoc[] = []) {
  const model = {
    findOne: vi.fn().mockReturnValue(chainQuery(card)),
    findById: vi.fn().mockReturnValue(chainQuery(card)),
    find: vi.fn().mockReturnValue(chainQuery(rows)),
  };
  const spend = {
    windowFor: vi.fn().mockResolvedValue(WINDOW),
    toSpendDto: vi.fn().mockReturnValue(SPEND_DTO),
  };
  const reader = new CardReader(
    model as unknown as Model<CardDoc>,
    spend as unknown as CardSpendService,
  );
  return { reader, model, spend };
}

describe('CardReader.loadOwned', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(cardDoc());
  });

  it('scopes the lookup by customer so another customer\'s card is simply absent', async () => {
    const card = await deps.reader.loadOwned(CARD_ID, CUSTOMER_ID);

    expect(deps.model.findOne).toHaveBeenCalledWith({ _id: CARD_ID, customerId: CUSTOMER_ID });
    expect(card._id).toBe(CARD_ID);
  });

  it('reports an unknown or foreign card with the same typed error', async () => {
    const { reader } = setup(null);

    await expect(reader.loadOwned(CARD_ID, CUSTOMER_ID)).rejects.toMatchObject({
      code: 'CARD_NOT_FOUND',
    });
    await expect(reader.loadOwned(CARD_ID, CUSTOMER_ID)).rejects.toThrow(DomainError);
  });
});

describe('CardReader.loadById', () => {
  it('loads by id alone for the staff-scoped paths', async () => {
    const { reader, model } = setup(cardDoc());

    const card = await reader.loadById(CARD_ID);

    expect(model.findById).toHaveBeenCalledWith(CARD_ID);
    expect(card._id).toBe(CARD_ID);
  });

  it('reports an unknown card as not found', async () => {
    const { reader } = setup(null);

    await expect(reader.loadById(CARD_ID)).rejects.toMatchObject({ code: 'CARD_NOT_FOUND' });
  });
});

describe('CardReader detail paths', () => {
  it('joins the card with its spend window', async () => {
    const { reader, spend } = setup(cardDoc());

    const detail = await reader.detail(cardDoc());

    expect(spend.windowFor).toHaveBeenCalledWith(CARD_ID);
    expect(spend.toSpendDto).toHaveBeenCalledWith(WINDOW, cardDoc().limits, 'USD');
    expect(detail.id).toBe(CARD_ID);
    expect(detail.spend).toBe(SPEND_DTO);
    expect(detail.pinSet).toBe(true);
  });

  it('loads owned before assembling the customer-facing detail', async () => {
    const { reader, model, spend } = setup(cardDoc());

    await reader.detailOwned(CARD_ID, CUSTOMER_ID);

    expect(model.findOne).toHaveBeenCalledWith({ _id: CARD_ID, customerId: CUSTOMER_ID });
    expect(spend.windowFor).toHaveBeenCalledWith(CARD_ID);
  });

  it('propagates the not-found from detailOwned without touching spend', async () => {
    const { reader, spend } = setup(null);

    await expect(reader.detailOwned(CARD_ID, CUSTOMER_ID)).rejects.toThrow(DomainError);
    expect(spend.windowFor).not.toHaveBeenCalled();
  });

  it('exposes the raw spend window for limit checks', async () => {
    const { reader, spend } = setup(cardDoc());

    await expect(reader.spendWindow(CARD_ID)).resolves.toBe(WINDOW);
    expect(spend.windowFor).toHaveBeenCalledWith(CARD_ID);
  });
});

describe('CardReader.list filter edge cases', () => {
  it('drops empty status and kind arrays instead of matching nothing', async () => {
    const { reader, model } = setup(cardDoc(), [cardDoc()]);

    await reader.list(CUSTOMER_ID, { limit: 10, status: [], kind: [] });

    expect(model.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
  });
});
