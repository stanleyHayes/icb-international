import {
  blockCardRequestSchema,
  cardQuerySchema,
  cursorQuerySchema,
  expireHoldRequestSchema,
  issueCardRequestSchema,
  reissueCardRequestSchema,
  updateCardLimitsRequestSchema,
  type BlockCardRequest,
  type CardAuthorisation,
  type CardDetail,
  type CardSummary,
  type CursorPage,
  type ExpireHoldRequest,
  type IssueCardRequest,
  type ReissueCardRequest,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { CardAuthorisationLogService, type AuthorisationQuery } from './application/card-authorisation-log.service.js';
import type { CardQuery } from './application/card-reader.js';
import type { UpdateLimitsRequest } from './application/card-settings.service.js';
import { CardsStaffService } from './cards-staff.service.js';

const CARD_ID = 'cardId';

/** Issuing a card and raising its limits move money risk, so they are operations-only. */
const OPERATIONS_ROLES = ['operations', 'admin', 'super_admin'] as const;
/** Blocking, replacing and force-expiring are the fraud-workflow actions. */
const FRAUD_ROLES = ['operations', 'fraud_analyst', 'admin', 'super_admin'] as const;

/**
 * The staff console's cards surface.
 *
 * Reads are open to every back-office role that works card cases; mutations are tightened per
 * handler and every one names its audit action, so the append-only trail reads as "who blocked
 * which card, and why". Staff identity comes from the verified token — a `:cardId` here is a
 * lookup key, not something the client gets to scope.
 */
@Controller('admin/cards')
@UseGuards(RolesGuard)
@Roles('support', 'operations', 'fraud_analyst', 'admin', 'super_admin')
export class CardsStaffController {
  constructor(
    private readonly staff: CardsStaffService,
    private readonly log: CardAuthorisationLogService,
  ) {}

  @Get()
  async list(@Query(zodBody(cardQuerySchema)) query: CardQuery): Promise<CursorPage<CardSummary>> {
    return this.staff.list(query);
  }

  @Post()
  @Roles(...OPERATIONS_ROLES)
  @AuditAction('cards.issue')
  async issue(
    @Body(zodBody(issueCardRequestSchema)) body: IssueCardRequest,
  ): Promise<CardDetail> {
    return this.staff.issue(body);
  }

  @Get(':cardId')
  async detail(@Param(CARD_ID) cardId: string): Promise<CardDetail> {
    return this.staff.detail(cardId);
  }

  @Post(':cardId/block')
  @Roles(...FRAUD_ROLES)
  @AuditAction('cards.block')
  async block(
    @CurrentUser() user: AccessTokenClaims,
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(blockCardRequestSchema)) body: BlockCardRequest,
  ): Promise<CardDetail> {
    return this.staff.block(cardId, body.reason, user.sub);
  }

  @Post(':cardId/reissue')
  @Roles(...FRAUD_ROLES)
  @AuditAction('cards.reissue')
  async reissue(
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(reissueCardRequestSchema)) body: ReissueCardRequest,
  ): Promise<CardDetail> {
    return this.staff.reissue(cardId, body);
  }

  /** Clears the PIN; the customer sets the new one themselves. Takes no body, by design. */
  @Post(':cardId/pin-reset')
  @Roles('support', ...OPERATIONS_ROLES)
  @AuditAction('cards.pin-reset')
  async resetPin(@Param(CARD_ID) cardId: string): Promise<CardDetail> {
    return this.staff.resetPin(cardId);
  }

  @Patch(':cardId/limits')
  @Roles(...OPERATIONS_ROLES)
  @AuditAction('cards.update-limits')
  async updateLimits(
    @Param(CARD_ID) cardId: string,
    @Body(zodBody(updateCardLimitsRequestSchema)) body: UpdateLimitsRequest,
  ): Promise<CardDetail> {
    return this.staff.updateLimits(cardId, body);
  }

  @Get(':cardId/authorisations')
  async authorisations(
    @Param(CARD_ID) cardId: string,
    @Query(zodBody(cursorQuerySchema)) query: AuthorisationQuery,
  ): Promise<CursorPage<CardAuthorisation>> {
    return this.log.listForCardAsStaff(cardId, query);
  }

  @Post(':cardId/authorisations/:authorisationId/expire')
  @Roles(...FRAUD_ROLES)
  @AuditAction('cards.expire-authorisation')
  async expireAuthorisation(
    @Param(CARD_ID) cardId: string,
    @Param('authorisationId') authorisationId: string,
    @Body(zodBody(expireHoldRequestSchema)) body: ExpireHoldRequest,
  ): Promise<CardAuthorisation> {
    return this.staff.expireAuthorisation(cardId, authorisationId, body.reason);
  }
}
