import type { Loan, LoanApplication } from '@icb/contracts';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import type { PostingActor } from '../ledger/domain/posting.types.js';
import {
  staffLoanDecisionRequestSchema,
  type StaffLoanDecisionRequest,
} from './domain/staff-decision.request.js';
import { LoanApplicationsService } from './loan-applications.service.js';
import { LoanDisbursementService } from './loan-disbursement.service.js';

/** Who moved the money, recorded on the posting itself rather than inferred from a log line. */
function staffActor(user: AccessTokenClaims): PostingActor {
  return { kind: 'staff', id: user.sub, label: user.email };
}

/**
 * The underwriting desk.
 *
 * Mounted under `loans/admin` so the static segment always wins against `loans/:loanId`, and
 * gated on the lending roles specifically — operations and support staff have no business
 * approving credit.
 */
@Controller('loans/admin')
@UseGuards(RolesGuard)
@Roles('underwriter', 'admin', 'super_admin')
export class LoansAdminController {
  constructor(
    private readonly applications: LoanApplicationsService,
    private readonly disbursement: LoanDisbursementService,
  ) {}

  @Get('queue')
  async queue(): Promise<{ items: LoanApplication[] }> {
    return { items: await this.applications.queue() };
  }

  @Post('applications/:applicationId/decision')
  async decide(
    @CurrentUser() user: AccessTokenClaims,
    @Param('applicationId') applicationId: string,
    @Body(zodBody(staffLoanDecisionRequestSchema)) body: StaffLoanDecisionRequest,
  ): Promise<LoanApplication> {
    return this.applications.decideByStaff(applicationId, user.email, body);
  }

  @Post(':loanId/disburse')
  async disburse(
    @CurrentUser() user: AccessTokenClaims,
    @Param('loanId') loanId: string,
  ): Promise<Loan> {
    return this.disbursement.disburse(loanId, staffActor(user));
  }
}
