import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { DomainError, ValidationError } from '../../../common/errors/index.js';
import { type CardReader } from '../application/card-reader.js';
import {
  CardSettingsService,
  type UpdateControlsRequest,
  type UpdateLimitsRequest,
} from '../application/card-settings.service.js';
import { defaultControls } from '../domain/card-defaults.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, CUSTOMER_ID, cardDoc } from './fixtures.js';

function money(minorUnits: number, currency = 'USD') {
  return { minorUnits, currency, scale: 2 } as const;
}

function setup(card: CardDoc) {
  const model = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const reader = {
    loadOwned: vi.fn().mockResolvedValue(card),
    loadById: vi.fn().mockResolvedValue(card),
    detail: vi.fn().mockResolvedValue({ id: card._id }),
    detailOwned: vi.fn().mockResolvedValue({ id: card._id }),
  };
  const service = new CardSettingsService(
    model as unknown as Model<CardDoc>,
    reader as unknown as CardReader,
  );
  return { service, model, reader };
}

describe('CardSettingsService.updateControls', () => {
  it('merges only the channels mentioned and leaves the rest of the controls alone', async () => {
    const { service, model } = setup(cardDoc());

    await service.updateControls(CARD_ID, CUSTOMER_ID, {
      channels: { online: false },
    } as UpdateControlsRequest);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          controls: {
            channels: { ...defaultControls('debit').channels, online: false },
            blockedCategories: [],
            allowedCountries: null,
          },
        },
      },
    );
  });

  it('replaces the blocked categories only when the request mentions them', async () => {
    const card = cardDoc({
      controls: { ...defaultControls('debit'), blockedCategories: ['dining'] },
    });
    const { service, model } = setup(card);

    await service.updateControls(CARD_ID, CUSTOMER_ID, {});
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          controls: expect.objectContaining({ blockedCategories: ['dining'] }),
        }),
      }),
    );
  });

  it('treats an explicit null country list as a change and an omitted one as keep', async () => {
    const card = cardDoc({
      controls: { ...defaultControls('debit'), allowedCountries: ['GH'] },
    });
    const { service, model } = setup(card);

    await service.updateControls(CARD_ID, CUSTOMER_ID, {
      allowedCountries: null,
    });
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          controls: expect.objectContaining({ allowedCountries: null }),
        }),
      }),
    );

    await service.updateControls(CARD_ID, CUSTOMER_ID, {});
    expect(model.updateOne).toHaveBeenLastCalledWith(
      { _id: CARD_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          controls: expect.objectContaining({ allowedCountries: ['GH'] }),
        }),
      }),
    );
  });

  it('refuses to change controls on a cancelled card', async () => {
    const { service, model } = setup(cardDoc({ status: 'cancelled' }));

    await expect(
      service.updateControls(CARD_ID, CUSTOMER_ID, {
        channels: { online: false },
      } as UpdateControlsRequest),
    ).rejects.toThrow(DomainError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardSettingsService.updateLimits', () => {
  it('merges the mentioned limits and writes the whole coherent set', async () => {
    const { service, model } = setup(cardDoc());

    await service.updateLimits(CARD_ID, CUSTOMER_ID, {
      daily: money(600_000),
    } as UpdateLimitsRequest);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          limits: {
            perTransactionMinorUnits: 200_000,
            dailyMinorUnits: 600_000,
            monthlyMinorUnits: 5_000_000,
            atmDailyMinorUnits: 100_000,
            contactlessMinorUnits: 10_000,
          },
        },
      },
    );
  });

  it('rejects a limit quoted in another currency', async () => {
    const { service, model } = setup(cardDoc());

    await expect(
      service.updateLimits(CARD_ID, CUSTOMER_ID, {
        daily: money(600_000, 'GHS'),
      } as UpdateLimitsRequest),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CURRENCY_MISMATCH' });
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('rejects an incoherent set where contactless exceeds per-transaction', async () => {
    const { service, model } = setup(cardDoc());

    await expect(
      service.updateLimits(CARD_ID, CUSTOMER_ID, {
        contactless: money(300_000),
      } as UpdateLimitsRequest),
    ).rejects.toThrow(ValidationError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('applies the same rules on the staff path without an ownership scope', async () => {
    const { service, model, reader } = setup(cardDoc());

    await service.updateLimitsAsStaff(CARD_ID, { atmDaily: money(50_000) } as UpdateLimitsRequest);

    expect(reader.loadById).toHaveBeenCalledWith(CARD_ID);
    expect(reader.loadOwned).not.toHaveBeenCalled();
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      expect.objectContaining({
        $set: expect.objectContaining({
          limits: expect.objectContaining({ atmDailyMinorUnits: 50_000 }),
        }),
      }),
    );
  });
});

describe('CardSettingsService.travelNotice', () => {
  it('stores the window as full UTC days with the travel countries', async () => {
    const { service, model } = setup(cardDoc());

    await service.travelNotice(CARD_ID, CUSTOMER_ID, {
      from: '2026-09-01',
      to: '2026-09-10',
      countries: ['FR'],
    });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      {
        $set: {
          travelNoticeFrom: new Date('2026-09-01T00:00:00.000Z'),
          travelNoticeUntil: new Date('2026-09-10T23:59:59.999Z'),
          travelCountries: ['FR'],
        },
      },
    );
  });

  it('rejects a notice that ends before it begins', async () => {
    const { service, model } = setup(cardDoc());

    await expect(
      service.travelNotice(CARD_ID, CUSTOMER_ID, {
        from: '2026-09-10',
        to: '2026-09-01',
        countries: ['FR'],
      }),
    ).rejects.toThrow(ValidationError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
