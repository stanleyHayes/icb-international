import { cardQuerySchema, type CardDetail, type CardSummary, type CursorPage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/index.js';
import { toCardDetail, toCardSummary } from '../infrastructure/card.mapper.js';
import { CardDoc } from '../infrastructure/card.schemas.js';
import { CardSpendService, type SpendWindow } from './card-spend.service.js';

export type CardQuery = ReturnType<typeof cardQuerySchema.parse>;

/** The card exists or it does not — a customer is never told which of the two it is for someone else's card. */
export function cardNotFound(cardId: string): DomainError {
  return new DomainError('CARD_NOT_FOUND', 'That card was not found', { context: { cardId } });
}

/**
 * Every read path for cards.
 *
 * Loading is centralised here for one reason: ownership. `loadOwned` scopes the query by customer
 * rather than fetching by id and comparing afterwards, so there is no code path where a forgotten
 * comparison hands one customer another's card (IDOR). Services that mutate a card take it from
 * here first and then write by id.
 */
@Injectable()
export class CardReader {
  constructor(
    @InjectModel(CardDoc.name) private readonly cards: Model<CardDoc>,
    private readonly spend: CardSpendService,
  ) {}

  async loadOwned(cardId: string, customerId: string): Promise<CardDoc> {
    const card = await this.cards.findOne({ _id: cardId, customerId }).lean();
    if (!card) {
      throw cardNotFound(cardId);
    }
    return card;
  }

  /** Used by the simulated card network, which authenticates as staff and has no customer scope. */
  async loadById(cardId: string): Promise<CardDoc> {
    const card = await this.cards.findById(cardId).lean();
    if (!card) {
      throw cardNotFound(cardId);
    }
    return card;
  }

  async detail(card: CardDoc): Promise<CardDetail> {
    const window = await this.spend.windowFor(card._id);
    return toCardDetail(card, this.spend.toSpendDto(window, card.limits, card.currency));
  }

  async detailOwned(cardId: string, customerId: string): Promise<CardDetail> {
    return this.detail(await this.loadOwned(cardId, customerId));
  }

  async spendWindow(cardId: string): Promise<SpendWindow> {
    return this.spend.windowFor(cardId);
  }

  async list(customerId: string, query: CardQuery): Promise<CursorPage<CardSummary>> {
    return this.listScoped(customerId, query);
  }

  /** The staff console's list: the same page shape with no ownership scope. */
  async listAll(query: CardQuery): Promise<CursorPage<CardSummary>> {
    return this.listScoped(null, query);
  }

  private async listScoped(
    customerId: string | null,
    query: CardQuery,
  ): Promise<CursorPage<CardSummary>> {
    const rows = await this.cards
      .find(buildFilter(customerId, query))
      // ULIDs sort lexicographically by creation time, so `_id` alone is a stable cursor.
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .lean();

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toCardSummary),
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }
}

function buildFilter(customerId: string | null, query: CardQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (customerId) {
    filter['customerId'] = customerId;
  }

  if (query.accountId) {
    filter['accountId'] = query.accountId;
  }
  if (query.status?.length) {
    filter['status'] = { $in: query.status };
  }
  if (query.kind?.length) {
    filter['kind'] = { $in: query.kind };
  }
  if (query.cursor) {
    filter['_id'] = { $lt: query.cursor };
  }
  return filter;
}
