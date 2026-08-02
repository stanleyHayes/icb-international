import {
  cardQuerySchema,
  issueCardRequestSchema,
  reportCardRequestSchema,
  updateCardRequestSchema,
  type CardDetail,
  type CardSummary,
  type CursorPage,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { CardsService, type UpdateCardRequest } from './cards.service.js';
import type { CardQuery } from './application/card-reader.js';

/** A bare POST means "freeze"; unfreezing is the same endpoint with the flag flipped. */
const freezeCardSchema = z
  .object({ frozen: z.boolean().default(true) })
  .default({ frozen: true });

const cancelCardSchema = z
  .object({ reason: z.string().min(1).max(200).default('Customer request') })
  .default({ reason: 'Customer request' });

const CARD_ID = 'cardId';

/**
 * The customer's own cards.
 *
 * Every handler takes the customer from the verified token and never from the path, so `:cardId`
 * is a lookup key scoped by ownership rather than an identifier to be trusted. There is no handler
 * here that can reach a card belonging to somebody else.
 */
@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(zodBody(cardQuerySchema)) query: CardQuery,
  ): Promise<CursorPage<CardSummary>> {
    return this.cards.list(customerId, query);
  }

  @Post()
  async issue(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(issueCardRequestSchema)) body: ReturnType<typeof issueCardRequestSchema.parse>,
  ): Promise<CardDetail> {
    return this.cards.issue(customerId, body);
  }

  @Get(':cardId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
  ): Promise<CardDetail> {
    return this.cards.detail(cardId, customerId);
  }

  @Patch(':cardId')
  async update(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(updateCardRequestSchema)) body: UpdateCardRequest,
  ): Promise<CardDetail> {
    return this.cards.update(cardId, customerId, body);
  }

  @Post(':cardId/activate')
  async activate(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
  ): Promise<CardDetail> {
    return this.cards.activate(cardId, customerId);
  }

  @Post(':cardId/freeze')
  async freeze(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(freezeCardSchema)) body: z.infer<typeof freezeCardSchema>,
  ): Promise<CardDetail> {
    return this.cards.setFrozen(cardId, customerId, body.frozen);
  }

  @Post(':cardId/cancel')
  async cancel(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(cancelCardSchema)) body: z.infer<typeof cancelCardSchema>,
  ): Promise<CardDetail> {
    return this.cards.cancel(cardId, customerId, body.reason);
  }

  /**
   * Report a card lost, stolen, damaged, undelivered or defrauded. Unless the customer opts out,
   * a replacement is issued and returned — linked to this card by `replacedCardId`.
   */
  @Post(':cardId/report')
  async report(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(reportCardRequestSchema)) body: ReturnType<typeof reportCardRequestSchema.parse>,
  ): Promise<CardDetail> {
    return this.cards.report(cardId, customerId, body);
  }
}
