import {
  kycDecisionRequestSchema,
  kycQueueQuerySchema,
  type KycCase,
  type OffsetPage,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { KycService } from './kyc.service.js';

/**
 * The compliance side of verification.
 *
 * Separate from the customer controller because the audiences are separate: these routes are
 * role-gated, they read any customer's case rather than the caller's own, and the decision
 * endpoint is the one place in the system that can change a customer's tier.
 */
@Controller('kyc')
@UseGuards(RolesGuard)
@Roles('compliance', 'operations', 'admin', 'super_admin')
export class KycStaffController {
  constructor(private readonly kyc: KycService) {}

  /** The review queue, most overdue first. */
  @Get('queue')
  async queue(
    @Query(new ZodValidationPipe(kycQueueQuerySchema))
    query: ReturnType<typeof kycQueueQuerySchema.parse>,
  ): Promise<OffsetPage<KycCase>> {
    return this.kyc.listQueue(query);
  }

  @Get('cases/:caseId')
  async detail(@Param('caseId') caseId: string): Promise<KycCase> {
    return this.kyc.caseById(caseId);
  }

  /** Approve (granting a tier), reject, or send the case back for more information. */
  @Post('cases/:caseId/decision')
  @HttpCode(HttpStatus.OK)
  async decide(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('caseId') caseId: string,
    @Body(zodBody(kycDecisionRequestSchema))
    body: ReturnType<typeof kycDecisionRequestSchema.parse>,
  ): Promise<KycCase> {
    // The decider is taken from the verified token, never from the request body.
    return this.kyc.decide(caseId, { id: staff.sub, label: staff.email }, body);
  }
}
