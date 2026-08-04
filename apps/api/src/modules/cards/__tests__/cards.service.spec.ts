import type { CardDetail, ReportCardRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, DomainError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type CardIssuanceService } from '../application/card-issuance.service.js';
import { type CardReader } from '../application/card-reader.js';
import { CardsService } from '../cards.service.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, CUSTOMER_ID, NOW, cardDoc } from './fixtures.js';

const REPLACEMENT_ID = '01J8ZCQ0R0K3M4N5P6Q7R8S9T9';
const DETAIL = { id: REPLACEMENT_ID } as unknown as CardDetail;

function setup(card: CardDoc = cardDoc()) {
  const model = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const replacement = cardDoc({ _id: REPLACEMENT_ID, replacedCardId: CARD_ID, status: 'issued' });
  const reader = {
    loadById: vi.fn().mockResolvedValue(card),
    loadOwned: vi.fn().mockResolvedValue(card),
    detail: vi.fn().mockResolvedValue(DETAIL),
    detailOwned: vi.fn().mockResolvedValue(DETAIL),
  };
  const issuance = { reissue: vi.fn().mockResolvedValue(replacement) };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardsService(
    model as unknown as Model<CardDoc>,
    reader as unknown as CardReader,
    issuance as unknown as CardIssuanceService,
    clock,
  );
  return { service, model, reader, issuance, replacement };
}

function stolenReport(): ReportCardRequest {
  return { reason: 'stolen', detail: 'Card taken in a robbery', reissue: true };
}

describe('CardsService.reportAsStaff', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('marks the card reported, mints a linked replacement, and returns the replacement', async () => {
    const result = await deps.service.reportAsStaff(CARD_ID, stolenReport());

    expect(deps.model.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: CARD_ID },
      {
        $set: {
          status: 'stolen',
          frozen: true,
          reportedReason: 'stolen: Card taken in a robbery',
          reportedAt: NOW,
          cancelledAt: null,
        },
      },
    );
    expect(deps.issuance.reissue).toHaveBeenCalledWith(cardDoc());
    // The replacement inherits the tuned controls and limits, and both ends of the chain are linked.
    expect(deps.model.updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: REPLACEMENT_ID },
      { $set: { controls: cardDoc().controls, limits: cardDoc().limits } },
    );
    expect(deps.model.updateOne).toHaveBeenNthCalledWith(
      3,
      { _id: CARD_ID },
      { $set: { replacedByCardId: REPLACEMENT_ID } },
    );
    expect(result).toBe(DETAIL);
  });

  it('treats fraud as theft and damaged as a cancellation', async () => {
    await deps.service.reportAsStaff(CARD_ID, { reason: 'fraud', reissue: true });
    expect(deps.model.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: CARD_ID },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'stolen' }) }),
    );

    deps.model.updateOne.mockClear();
    await deps.service.reportAsStaff(CARD_ID, { reason: 'damaged', reissue: true });
    expect(deps.model.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: CARD_ID },
      {
        $set: {
          status: 'cancelled',
          frozen: true,
          reportedReason: 'damaged',
          reportedAt: NOW,
          cancelledAt: NOW,
        },
      },
    );
  });

  it('refuses to report a card already in a terminal status', async () => {
    const { service, model, issuance } = setup(cardDoc({ status: 'lost' }));

    await expect(service.reportAsStaff(CARD_ID, stolenReport())).rejects.toThrow(DomainError);
    expect(model.updateOne).not.toHaveBeenCalled();
    expect(issuance.reissue).not.toHaveBeenCalled();
  });

  it('propagates the typed not-found for an unknown card', async () => {
    deps.reader.loadById.mockRejectedValue(new DomainError('CARD_NOT_FOUND', 'That card was not found'));
    await expect(deps.service.reportAsStaff(CARD_ID, stolenReport())).rejects.toThrow(DomainError);
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardsService.blockAsStaff', () => {
  it('freezes the card and records the staff member who blocked it', async () => {
    const deps = setup();

    await deps.service.blockAsStaff(CARD_ID, 'Confirmed fraud on the account', 'staff-ops-1');

    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          frozen: true,
          status: 'frozen',
          blockedReason: 'Confirmed fraud on the account',
          blockedBy: 'staff-ops-1',
          blockedAt: NOW,
        },
      },
    );
  });

  it('refuses to block a card in a terminal status', async () => {
    const deps = setup(cardDoc({ status: 'cancelled' }));

    await expect(
      deps.service.blockAsStaff(CARD_ID, 'Confirmed fraud on the account', 'staff-ops-1'),
    ).rejects.toThrow(DomainError);
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });

  it('propagates the typed not-found for an unknown card', async () => {
    const deps = setup();
    deps.reader.loadById.mockRejectedValue(
      new DomainError('CARD_NOT_FOUND', 'That card was not found'),
    );

    await expect(
      deps.service.blockAsStaff(CARD_ID, 'Confirmed fraud on the account', 'staff-ops-1'),
    ).rejects.toThrow(DomainError);
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardsService staff-block guard', () => {
  it('refuses a customer unfreeze on a card staff blocked', async () => {
    const { service, model } = setup(
      cardDoc({ status: 'frozen', frozen: true, blockedBy: 'staff-ops-1' }),
    );

    await expect(service.update(CARD_ID, CUSTOMER_ID, { frozen: false })).rejects.toThrow(
      ConflictError,
    );
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses activation on a card staff blocked before it was ever used', async () => {
    const { service, model } = setup(
      cardDoc({ status: 'issued', activatedAt: null, blockedBy: 'staff-ops-1' }),
    );

    await expect(service.activate(CARD_ID, CUSTOMER_ID)).rejects.toThrow(ConflictError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('still lets the customer freeze and unfreeze their own card when no block exists', async () => {
    const { service, model } = setup(cardDoc());

    await service.update(CARD_ID, CUSTOMER_ID, { frozen: true });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { frozen: true, status: 'frozen' } },
    );
  });
});
