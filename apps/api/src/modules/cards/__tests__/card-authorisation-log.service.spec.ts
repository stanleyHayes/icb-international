import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CardAuthorisationLogService } from '../application/card-authorisation-log.service.js';
import { type CardReader } from '../application/card-reader.js';
import type { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import {
  AUTHORISATION_ID,
  CARD_ID,
  CUSTOMER_ID,
  NOW,
  authorisationDoc,
  chainQuery,
} from './fixtures.js';

function setup(rows: CardAuthorisationDoc[], modifiedCount = 0) {
  const model = {
    find: vi.fn().mockReturnValue(chainQuery(rows)),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount }),
  };
  const reader = {
    loadOwned: vi.fn().mockResolvedValue(undefined),
    loadById: vi.fn().mockResolvedValue(undefined),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardAuthorisationLogService(
    model as unknown as Model<CardAuthorisationDoc>,
    reader as unknown as CardReader,
    clock,
  );
  return { service, model, reader };
}

describe('CardAuthorisationLogService.listForCard', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup([authorisationDoc()]);
  });

  it('proves ownership before reading a single authorisation row', async () => {
    await deps.service.listForCard(CARD_ID, CUSTOMER_ID, { limit: 25 });

    expect(deps.reader.loadOwned).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID);
    expect(deps.model.find).toHaveBeenCalledWith({ cardId: CARD_ID });
  });

  it('never reads the log when the customer does not own the card', async () => {
    deps.reader.loadOwned.mockRejectedValue(new Error('CARD_NOT_FOUND'));

    await expect(deps.service.listForCard(CARD_ID, CUSTOMER_ID, { limit: 25 })).rejects.toThrow(
      'CARD_NOT_FOUND',
    );
    expect(deps.model.find).not.toHaveBeenCalled();
  });

  it('pages backwards from the cursor when one is supplied', async () => {
    await deps.service.listForCard(CARD_ID, CUSTOMER_ID, { limit: 25, cursor: 'cur-9' });

    expect(deps.model.find).toHaveBeenCalledWith({ cardId: CARD_ID, _id: { $lt: 'cur-9' } });
  });

  it('trims the lookahead row into a cursor', async () => {
    const rows = [
      authorisationDoc({ _id: 'auth-3' }),
      authorisationDoc({ _id: 'auth-2' }),
      authorisationDoc({ _id: 'auth-1' }),
    ];
    const { service } = setup(rows);

    const page = await service.listForCard(CARD_ID, CUSTOMER_ID, { limit: 2 });

    expect(page.items.map((item) => item.id)).toEqual(['auth-3', 'auth-2']);
    expect(page.nextCursor).toBe('auth-2');
    expect(page.hasMore).toBe(true);
  });

  it('returns a closed page when the lookahead row is absent', async () => {
    const { service } = setup([authorisationDoc({ _id: AUTHORISATION_ID })]);

    const page = await service.listForCard(CARD_ID, CUSTOMER_ID, { limit: 25 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.merchantName).toBe('Shoprite Accra');
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });
});

describe('CardAuthorisationLogService.listForCardAsStaff', () => {
  it('checks the card exists without an ownership scope', async () => {
    const { service, model, reader } = setup([authorisationDoc()]);

    await service.listForCardAsStaff(CARD_ID, { limit: 25 });

    expect(reader.loadById).toHaveBeenCalledWith(CARD_ID);
    expect(reader.loadOwned).not.toHaveBeenCalled();
    expect(model.find).toHaveBeenCalledWith({ cardId: CARD_ID });
  });
});

describe('CardAuthorisationLogService.expireDue', () => {
  it('expires only approved authorisations whose window has closed', async () => {
    const { service, model } = setup([], 3);

    const count = await service.expireDue();

    expect(model.updateMany).toHaveBeenCalledWith(
      { status: 'approved', expiresAt: { $lte: NOW } },
      { $set: { status: 'expired' } },
    );
    expect(count).toBe(3);
  });

  it('is a no-op when nothing is due', async () => {
    const { service } = setup([], 0);

    await expect(service.expireDue()).resolves.toBe(0);
  });
});
