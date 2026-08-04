import type { CardDetail } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, DomainError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type CardIssuanceService } from '../application/card-issuance.service.js';
import { type CardReader } from '../application/card-reader.js';
import { CardsService } from '../cards.service.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, CUSTOMER_ID, NOW, cardDoc } from './fixtures.js';

const DETAIL = { id: CARD_ID } as unknown as CardDetail;

function setup(card: CardDoc = cardDoc()) {
  const model = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const reader = {
    loadById: vi.fn().mockResolvedValue(card),
    loadOwned: vi.fn().mockResolvedValue(card),
    detail: vi.fn().mockResolvedValue(DETAIL),
    detailOwned: vi.fn().mockResolvedValue(DETAIL),
  };
  const issuance = { issue: vi.fn(), reissue: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardsService(
    model as unknown as Model<CardDoc>,
    reader as unknown as CardReader,
    issuance as unknown as CardIssuanceService,
    clock,
  );
  return { service, model, reader, issuance };
}

describe('CardsService.update', () => {
  it('writes only the nickname when that is all that changed', async () => {
    const { service, model } = setup();

    await service.update(CARD_ID, CUSTOMER_ID, { nickname: 'Groceries card' });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { nickname: 'Groceries card' } },
    );
  });

  it('writes only the contactless switch when that is all that changed', async () => {
    const { service, model } = setup();

    await service.update(CARD_ID, CUSTOMER_ID, { contactlessEnabled: false });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { contactlessEnabled: false } },
    );
  });

  it('writes nothing when the request is empty', async () => {
    const { service, model } = setup();

    const result = await service.update(CARD_ID, CUSTOMER_ID, {});

    expect(model.updateOne).not.toHaveBeenCalled();
    expect(result).toBe(DETAIL);
  });

  it('returns an unactivated card to issued when it is unfrozen', async () => {
    const { service, model } = setup(
      cardDoc({ status: 'frozen', frozen: true, activatedAt: null }),
    );

    await service.update(CARD_ID, CUSTOMER_ID, { frozen: false });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { frozen: false, status: 'issued' } },
    );
  });

  it('refuses any update on a card in a terminal status', async () => {
    const { service, model } = setup(cardDoc({ status: 'stolen' }));

    await expect(
      service.update(CARD_ID, CUSTOMER_ID, { nickname: 'New name' }),
    ).rejects.toThrow(DomainError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardsService.setFrozen', () => {
  it('freezes through the same guarded update path', async () => {
    const { service, model } = setup();

    await service.setFrozen(CARD_ID, CUSTOMER_ID, true);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { frozen: true, status: 'frozen' } },
    );
  });

  it('unfreezes back to active for an activated card', async () => {
    const { service, model } = setup(cardDoc({ status: 'frozen', frozen: true }));

    await service.setFrozen(CARD_ID, CUSTOMER_ID, false);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { frozen: false, status: 'active' } },
    );
  });
});

describe('CardsService.activate', () => {
  it('activates a newly issued card and stamps the activation time', async () => {
    const { service, model } = setup(cardDoc({ status: 'issued', activatedAt: null }));

    await service.activate(CARD_ID, CUSTOMER_ID);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { status: 'active', activatedAt: NOW, frozen: false } },
    );
  });

  it('refuses to activate a card that is already active', async () => {
    const { service, model } = setup(cardDoc({ status: 'active' }));

    await expect(service.activate(CARD_ID, CUSTOMER_ID)).rejects.toThrow(ConflictError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardsService.cancel', () => {
  it('cancels, freezes and records the reason and the time', async () => {
    const { service, model } = setup();

    await service.cancel(CARD_ID, CUSTOMER_ID, 'No longer needed');

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          status: 'cancelled',
          frozen: true,
          cancelledAt: NOW,
          cancellationReason: 'No longer needed',
        },
      },
    );
  });

  it('refuses to cancel a card already in a terminal status', async () => {
    const { service, model } = setup(cardDoc({ status: 'lost' }));

    await expect(service.cancel(CARD_ID, CUSTOMER_ID, 'No longer needed')).rejects.toThrow(
      DomainError,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardsService.report', () => {
  it('marks a lost card and returns it unchanged when the customer declines a reissue', async () => {
    const { service, model, reader, issuance } = setup();

    const result = await service.report(CARD_ID, CUSTOMER_ID, { reason: 'lost', reissue: false });

    expect(reader.loadOwned).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID);
    expect(model.updateOne).toHaveBeenCalledTimes(1);
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          status: 'lost',
          frozen: true,
          reportedReason: 'lost',
          reportedAt: NOW,
          cancelledAt: null,
        },
      },
    );
    expect(issuance.reissue).not.toHaveBeenCalled();
    expect(reader.detail).toHaveBeenCalledWith(cardDoc());
    expect(result).toBe(DETAIL);
  });

  it('records a card that never arrived as cancelled with a cancellation time', async () => {
    const { service, model } = setup();

    await service.report(CARD_ID, CUSTOMER_ID, { reason: 'not_received', reissue: false });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          status: 'cancelled',
          frozen: true,
          reportedReason: 'not_received',
          reportedAt: NOW,
          cancelledAt: NOW,
        },
      },
    );
  });
});
