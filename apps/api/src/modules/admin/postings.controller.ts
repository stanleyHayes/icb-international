import {
  manualPostingRequestSchema,
  type ApprovalRequest,
  type ManualPostingRequest,
} from '@icb/contracts';
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { ManualPostingsService } from './manual-postings.service.js';

/**
 * Manual credit/debit entry point.
 *
 * The most dangerous endpoint in the system, so it only *raises* the posting: the staff id
 * comes from the verified token, the request goes to the maker-checker inbox, and the posting
 * itself is written by the sweep worker after a second operator approves.
 */
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('operations', 'admin', 'super_admin')
export class PostingsController {
  constructor(private readonly manualPostings: ManualPostingsService) {}

  @Post('postings')
  @HttpCode(201)
  @AuditAction('admin.manual-posting.request')
  async request(
    @CurrentUser() user: AccessTokenClaims,
    @Body(zodBody(manualPostingRequestSchema)) body: ManualPostingRequest,
  ): Promise<ApprovalRequest> {
    // CONTRACT REQUEST: SDK declares the response as transactionDetailSchema; with maker-checker
    // the honest response is the ApprovalRequest (the posting only exists after approval).
    return this.manualPostings.requestManualPosting(body, user.sub);
  }
}
