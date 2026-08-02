import {
  advanceDisputeRequestSchema,
  disputeQuerySchema,
  type CursorPage,
  type Dispute,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import type { AdvanceDisputeRequest } from './application/dispute-stage.service.js';
import { DisputesService, type DisputeQuery } from './disputes.service.js';
import { FRAUD_ROLES } from './risk.roles.js';

/**
 * The dispute back office.
 *
 * Registered ahead of the customer controller so `/disputes/admin/queue` is unambiguous, and
 * role-gated as a whole: advancing a stage can move real money, so there is no route here that a
 * customer principal can reach.
 */
@Controller('disputes')
@UseGuards(RolesGuard)
@Roles(...FRAUD_ROLES)
export class DisputesAdminController {
  constructor(private readonly disputes: DisputesService) {}

  /** The work queue, tightest deadline first. */
  @Get('admin/queue')
  async queue(
    @Query(new ZodValidationPipe(disputeQuerySchema)) query: DisputeQuery,
  ): Promise<CursorPage<Dispute>> {
    return this.disputes.queue(query);
  }

  @Get('admin/:disputeId')
  async detail(@Param('disputeId') disputeId: string): Promise<Dispute> {
    return this.disputes.byIdForStaff(disputeId);
  }

  /**
   * Move a dispute to its next stage.
   *
   * This is the endpoint that grants provisional credit and claws it back, so the acting analyst
   * is taken from the verified token and recorded on the dispute.
   */
  @Post(':disputeId/advance')
  @HttpCode(HttpStatus.OK)
  async advance(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('disputeId') disputeId: string,
    @Body(zodBody(advanceDisputeRequestSchema)) body: AdvanceDisputeRequest,
  ): Promise<Dispute> {
    return this.disputes.advance(disputeId, { id: staff.sub, label: staff.email }, body);
  }
}
