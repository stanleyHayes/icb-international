import {
  setAccountStatusRequestSchema,
  setOverdraftRequestSchema,
  type AccountDetail,
} from '@icb/contracts';
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { AccountStatusService } from './application/account-status.service.js';

type SetAccountStatusRequest = z.infer<typeof setAccountStatusRequestSchema>;
type SetOverdraftRequest = z.infer<typeof setOverdraftRequestSchema>;

/**
 * Staff-driven account lifecycle.
 *
 * Freeze, unfreeze, dormancy, administrative closure and overdraft decisions all go through the
 * state machine here, and every call names its audit action so the append-only trail (N7) reads
 * as a sentence: who froze which account, and when.
 */
@Controller('admin/accounts')
@UseGuards(RolesGuard)
@Roles('operations', 'compliance', 'admin', 'super_admin')
export class AdminAccountsController {
  constructor(private readonly status: AccountStatusService) {}

  @Post(':accountId/status')
  @AuditAction('account.set-status')
  async setStatus(
    @Param('accountId') accountId: string,
    @Body(zodBody(setAccountStatusRequestSchema)) body: SetAccountStatusRequest,
  ): Promise<AccountDetail> {
    return this.status.transition(accountId, body.status, body.reason);
  }

  @Post(':accountId/overdraft')
  @AuditAction('account.set-overdraft')
  async setOverdraft(
    @Param('accountId') accountId: string,
    @Body(zodBody(setOverdraftRequestSchema)) body: SetOverdraftRequest,
  ): Promise<AccountDetail> {
    return this.status.setOverdraft(accountId, body.limit.minorUnits);
  }
}
