import type {
  CardDetail,
  updateCardControlsRequestSchema,
  updateCardLimitsRequestSchema,
  travelNoticeRequestSchema,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ValidationError } from '../../../common/errors/index.js';
import type { CardControlsDoc, CardLimitsDoc } from '../domain/card-defaults.js';
import { assertCardAmendable } from '../domain/card-state.js';
import { assertCoherentLimits, mergeLimits } from '../domain/limit-rules.js';
import { CardDoc } from '../infrastructure/card.schemas.js';
import { CardReader } from './card-reader.js';

export type UpdateControlsRequest = ReturnType<typeof updateCardControlsRequestSchema.parse>;
export type UpdateLimitsRequest = ReturnType<typeof updateCardLimitsRequestSchema.parse>;
export type TravelNoticeRequest = ReturnType<typeof travelNoticeRequestSchema.parse>;

const DAY_END = 'T23:59:59.999Z';
const DAY_START = 'T00:00:00.000Z';

/**
 * The settings a customer owns on their own card.
 *
 * Updates are merges, never replacements: a client that sends only `blockedCategories` must not
 * silently reset the channel switches it did not mention. Every write goes through the same
 * amendability guard, so a cancelled card cannot have its limits raised.
 */
@Injectable()
export class CardSettingsService {
  constructor(
    @InjectModel(CardDoc.name) private readonly cards: Model<CardDoc>,
    private readonly reader: CardReader,
  ) {}

  async updateControls(
    cardId: string,
    customerId: string,
    request: UpdateControlsRequest,
  ): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);

    const controls: CardControlsDoc = {
      channels: { ...card.controls.channels, ...request.channels },
      blockedCategories: request.blockedCategories ?? card.controls.blockedCategories,
      allowedCountries:
        request.allowedCountries === undefined
          ? card.controls.allowedCountries
          : request.allowedCountries,
    };

    await this.cards.updateOne({ _id: card._id }, { $set: { controls } });
    return this.reader.detailOwned(cardId, customerId);
  }

  async updateLimits(
    cardId: string,
    customerId: string,
    request: UpdateLimitsRequest,
  ): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    return this.applyLimits(card, request);
  }

  /** The staff console's limits change: the same merge and coherence rules, no ownership scope. */
  async updateLimitsAsStaff(cardId: string, request: UpdateLimitsRequest): Promise<CardDetail> {
    const card = await this.reader.loadById(cardId);
    return this.applyLimits(card, request);
  }

  private async applyLimits(card: CardDoc, request: UpdateLimitsRequest): Promise<CardDetail> {
    assertCardAmendable(card);

    const limits: CardLimitsDoc = mergeLimits(card.limits, request, card.currency);
    assertCoherentLimits(limits);

    await this.cards.updateOne({ _id: card._id }, { $set: { limits } });
    return this.reader.detail(card);
  }

  /**
   * A travel notice relaxes the geographic controls for a window, and nothing else. It does not
   * raise a limit and it does not switch a channel on — a customer abroad is still a customer who
   * turned online payments off.
   */
  async travelNotice(
    cardId: string,
    customerId: string,
    request: TravelNoticeRequest,
  ): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);

    if (request.from > request.to) {
      throw new ValidationError('A travel notice cannot end before it begins', [
        { path: 'from', message: 'Must not be after the end date' },
      ]);
    }

    await this.cards.updateOne(
      { _id: card._id },
      {
        $set: {
          travelNoticeFrom: new Date(`${request.from}${DAY_START}`),
          travelNoticeUntil: new Date(`${request.to}${DAY_END}`),
          travelCountries: request.countries,
        },
      },
    );

    return this.reader.detailOwned(cardId, customerId);
  }
}
