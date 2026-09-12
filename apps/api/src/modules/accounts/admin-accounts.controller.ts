import {
  balanceHistoryQuerySchema,
  changeAccountProductRequestSchema,
  releaseHoldRequestSchema,
  setAccountStatusRequestSchema,
  setInterestOverrideRequestSchema,
  setOverdraftRequestSchema,
  type AccountDetail,
  type BalanceHistory,
  type Hold,
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
import type { z } from 'zod';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { AccountsService } from './accounts.service.js';
import { AccountHoldsService } from './application/account-holds.service.js';
import { AccountStatusService } from './application/account-status.service.js';
import { AccountTermsService } from './application/account-terms.service.js';
import { BalanceHistoryService } from './application/balance-history.service.js';

type SetAccountStatusRequest = z.infer<typeof setAccountStatusRequestSchema>;
type SetOverdraftRequest = z.infer<typeof setOverdraftRequestSchema>;
type ChangeProductRequest = z.infer<typeof changeAccountProductRequestSchema>;
type SetInterestOverrideRequest = z.infer<typeof setInterestOverrideRequestSchema>;
type ReleaseHoldRequest = z.infer<typeof releaseHoldRequestSchema>;

/**
 * The staff view of one account, and the lifecycle actions against it.
 *
 * Freeze, unfreeze, dormancy, administrative closure and overdraft decisions all go through the
 * state machine here, and every call names its audit action so the append-only trail (N7) reads
 * as a sentence: who froze which account, and when.
 *
 * The reads are the staff counterparts of the customer routes on `AccountsController`, and they
 * differ in exactly one way: the customer's own routes scope every lookup by ownership, while
 * these are authorised by the role guard because staff operate on accounts they do not own.
 */
@Controller('admin/accounts')
@UseGuards(RolesGuard)
@Roles('operations', 'compliance', 'admin', 'super_admin')
export class AdminAccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly status: AccountStatusService,
    private readonly terms: AccountTermsService,
    private readonly history: BalanceHistoryService,
    private readonly holds: AccountHoldsService,
  ) {}

  @Get(':accountId')
  async detail(@Param('accountId') accountId: string): Promise<AccountDetail> {
    return this.accounts.getForStaff(accountId);
  }

  @Get(':accountId/balance-history')
  async balanceHistory(
    @Param('accountId') accountId: string,
    @Query(zodBody(balanceHistoryQuerySchema))
    query: z.infer<typeof balanceHistoryQuerySchema>,
  ): Promise<BalanceHistory> {
    const account = await this.accounts.getForStaff(accountId);
    return this.history.historyFor(account, query);
  }

  @Get(':accountId/holds')
  async accountHolds(@Param('accountId') accountId: string): Promise<Hold[]> {
    // A bare array, matching the customer route and what the SDK declares.
    await this.accounts.getForStaff(accountId);
    return this.holds.holdsFor(accountId);
  }

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

  @Post(':accountId/product')
  @AuditAction('account.change-product')
  async changeProduct(
    @Param('accountId') accountId: string,
    @Body(zodBody(changeAccountProductRequestSchema)) body: ChangeProductRequest,
  ): Promise<AccountDetail> {
    return this.terms.changeProduct(accountId, body.productCode);
  }

  @Post(':accountId/interest-override')
  @AuditAction('account.set-interest-override')
  async setInterestOverride(
    @Param('accountId') accountId: string,
    @Body(zodBody(setInterestOverrideRequestSchema)) body: SetInterestOverrideRequest,
  ): Promise<AccountDetail> {
    return this.terms.setInterestOverride(accountId, body.rate);
  }

  @Post(':accountId/holds/:holdId/force-expire')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('account.release-hold')
  async releaseHold(
    @Param('accountId') accountId: string,
    @Param('holdId') holdId: string,
    @Body(zodBody(releaseHoldRequestSchema)) body: ReleaseHoldRequest,
  ): Promise<void> {
    await this.terms.releaseHold(accountId, holdId, body.reason);
  }
}
