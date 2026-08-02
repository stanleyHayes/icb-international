import {
  cardChannelSchema,
  countryCodeSchema,
  positiveMoneySchema,
  type CardAuthorisation,
} from '@icb/contracts';
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { CardAuthorisationLogService } from './application/card-authorisation-log.service.js';
import { CardAuthorisationService } from './application/card-authorisation.service.js';
import { CardCaptureService } from './application/card-capture.service.js';

/** An authorisation request as the card network would present it. */
const authoriseCardSchema = z.object({
  merchantName: z.string().min(1).max(120),
  mcc: z.string().regex(/^\d{4}$/, 'An MCC is exactly four digits'),
  amount: positiveMoneySchema,
  channel: cardChannelSchema,
  country: countryCodeSchema.nullable().default(null),
});

/** Omitting the amount captures the full authorised value; supplying less is a partial capture. */
const captureAuthorisationSchema = z.object({ amount: positiveMoneySchema.optional() }).default({});

const AUTHORISATION_ID = 'authorisationId';

/**
 * The simulated card network.
 *
 * These endpoints stand in for the messages an acquirer would send: an authorisation request, a
 * capture when the merchant claims the money, a reversal when they abandon the sale, and the
 * nightly sweep that ages out authorisations nobody ever claimed. They are staff-only because
 * nothing a customer does should be able to move money by pretending to be a terminal.
 */
@Controller('cards')
@Roles('operations', 'admin', 'super_admin')
@UseGuards(RolesGuard)
export class CardNetworkController {
  constructor(
    private readonly authorisations: CardAuthorisationService,
    private readonly capture: CardCaptureService,
    private readonly log: CardAuthorisationLogService,
  ) {}

  @Post(':cardId/authorise')
  async authorise(
    @Param('cardId') cardId: string,
    @Body(zodBody(authoriseCardSchema)) body: z.infer<typeof authoriseCardSchema>,
  ): Promise<CardAuthorisation> {
    return this.authorisations.authorise(cardId, body);
  }

  @Post('authorisations/:authorisationId/capture')
  async captureAuthorisation(
    @Param(AUTHORISATION_ID) authorisationId: string,
    @Body(zodBody(captureAuthorisationSchema)) body: z.infer<typeof captureAuthorisationSchema>,
  ): Promise<CardAuthorisation> {
    return this.capture.capture(authorisationId, body.amount?.minorUnits);
  }

  @Post('authorisations/:authorisationId/reverse')
  async reverseAuthorisation(
    @Param(AUTHORISATION_ID) authorisationId: string,
  ): Promise<CardAuthorisation> {
    return this.capture.reverse(authorisationId);
  }

  /** Ages out every authorisation whose seven-day window closed without a capture. */
  @Post('authorisations/expire')
  async expire(): Promise<{ expired: number }> {
    return { expired: await this.log.expireDue() };
  }
}
