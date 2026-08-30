import {
  decideApprovalRequestSchema,
  type ApprovalRequest,
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

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { ApprovalsService } from './approvals.service.js';
import { approvalInboxQuerySchema, type ApprovalInboxQueryInput } from './iam.requests.js';

/**
 * The maker-checker inbox.
 *
 * Any operator may read the queue — visibility of pending privileged actions is itself a
 * control. Deciding is the sensitive act, and the service enforces the two rules that make
 * four-eyes real (never your own request, never after expiry). The decider is the token
 * subject, never a value from the request.
 */
@Controller('admin/approvals')
@UseGuards(RolesGuard)
@Roles(
  'support',
  'teller',
  'operations',
  'underwriter',
  'fraud_analyst',
  'aml_officer',
  'compliance',
  'admin',
  'super_admin',
)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  async listInbox(
    @Query(new ZodValidationPipe(approvalInboxQuerySchema))
    query: ApprovalInboxQueryInput,
  ): Promise<ApprovalRequest[]> {
    return this.approvals.listInbox(query);
  }

  @Get(':approvalId')
  async getApproval(@Param('approvalId') approvalId: string): Promise<ApprovalRequest> {
    return this.approvals.getApproval(approvalId);
  }

  @Post(':approvalId/decision')
  @HttpCode(HttpStatus.OK)
  @AuditAction('approval.decide')
  async decide(
    @CurrentUser() checker: AccessTokenClaims,
    @Param('approvalId') approvalId: string,
    @Body(zodBody(decideApprovalRequestSchema))
    body: ReturnType<typeof decideApprovalRequestSchema.parse>,
  ): Promise<ApprovalRequest> {
    return body.decision === 'approve'
      ? this.approvals.approve(approvalId, checker.sub, body.reason)
      : this.approvals.reject(approvalId, checker.sub, body.reason);
  }
}
