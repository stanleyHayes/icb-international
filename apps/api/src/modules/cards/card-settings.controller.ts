import {
  cursorQuerySchema,
  setCardPinRequestSchema,
  travelNoticeRequestSchema,
  updateCardControlsRequestSchema,
  updateCardLimitsRequestSchema,
  type CardAuthorisation,
  type CardDetail,
  type CardSensitiveDetails,
  type CursorPage,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentCustomer, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { CardAuthorisationLogService, type AuthorisationQuery } from './application/card-authorisation-log.service.js';
import { CardSecurityService } from './application/card-security.service.js';
import {
  CardSettingsService,
  type TravelNoticeRequest,
  type UpdateControlsRequest,
  type UpdateLimitsRequest,
} from './application/card-settings.service.js';

const CARD_ID = 'cardId';

/**
 * Controls, limits, PIN, travel notices, the authorisation history, and the PAN reveal.
 *
 * Split from the lifecycle controller because these are the endpoints a customer touches
 * repeatedly, while issuing and reporting happen once or twice in a card's life.
 */
@Controller('cards')
export class CardSettingsController {
  constructor(
    private readonly settings: CardSettingsService,
    private readonly security: CardSecurityService,
    private readonly log: CardAuthorisationLogService,
  ) {}

  @Patch(':cardId/controls')
  async updateControls(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(updateCardControlsRequestSchema)) body: UpdateControlsRequest,
  ): Promise<CardDetail> {
    return this.settings.updateControls(cardId, customerId, body);
  }

  @Patch(':cardId/limits')
  async updateLimits(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(updateCardLimitsRequestSchema)) body: UpdateLimitsRequest,
  ): Promise<CardDetail> {
    return this.settings.updateLimits(cardId, customerId, body);
  }

  /** Sets or replaces the PIN. The plaintext is hashed with argon2 and never stored or returned. */
  @Post(':cardId/pin')
  async setPin(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(setCardPinRequestSchema)) body: ReturnType<typeof setCardPinRequestSchema.parse>,
  ): Promise<CardDetail> {
    return this.security.setPin(cardId, customerId, body.pin);
  }

  @Post(':cardId/travel-notice')
  async travelNotice(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(travelNoticeRequestSchema)) body: TravelNoticeRequest,
  ): Promise<CardDetail> {
    return this.settings.travelNotice(cardId, customerId, body);
  }

  @Get(':cardId/authorisations')
  async authorisations(
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
    @Query(zodBody(cursorQuerySchema)) query: AuthorisationQuery,
  ): Promise<CursorPage<CardAuthorisation>> {
    return this.log.listForCard(cardId, customerId, query);
  }

  /**
   * The full PAN, CVV and expiry — for the card's owner, on their authenticated session.
   */
  @Get(':cardId/sensitive')
  async sensitive(
    @CurrentUser() user: AccessTokenClaims,
    @CurrentCustomer() customerId: string,
    @Param(CARD_ID) cardId: string,
  ): Promise<CardSensitiveDetails> {
    return this.security.reveal(cardId, customerId, user.sub);
  }
}
