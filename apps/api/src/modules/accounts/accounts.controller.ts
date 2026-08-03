import {
  balanceHistoryQuerySchema,
  closeAccountRequestSchema,
  openAccountRequestSchema,
  updateAccountRequestSchema,
  type AccountBalances,
  type AccountDetail,
  type AccountSummary,
  type BalanceHistory,
  type Hold,
  type OpenAccountRequest,
  type UpdateAccountRequest,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { z } from 'zod';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { AccountsService } from './accounts.service.js';
import { AccountClosureService } from './application/account-closure.service.js';
import { AccountHoldsService } from './application/account-holds.service.js';
import { AccountOpeningService } from './application/account-opening.service.js';
import { AccountProfileService } from './application/account-profile.service.js';
import { BalanceHistoryService } from './application/balance-history.service.js';

type CloseAccountRequest = z.infer<typeof closeAccountRequestSchema>;

/**
 * The customer's own accounts.
 *
 * Every handler takes the customer from the verified token and never from the path, so
 * `:accountId` is a lookup key scoped by ownership rather than an identifier to be trusted.
 * Mutations that can move or open value are `@Idempotent()` — a retried open or close replays
 * the original response instead of acting twice (N6).
 */
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly opening: AccountOpeningService,
    private readonly closure: AccountClosureService,
    private readonly history: BalanceHistoryService,
    private readonly profile: AccountProfileService,
    private readonly accountHolds: AccountHoldsService,
  ) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: AccountSummary[] }> {
    return { items: await this.accounts.listForCustomer(customerId) };
  }

  @Post()
  @Idempotent()
  async open(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(openAccountRequestSchema)) body: OpenAccountRequest,
  ): Promise<AccountDetail> {
    return this.opening.openForCustomer(customerId, body);
  }

  @Get(':accountId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('accountId') accountId: string,
  ): Promise<AccountDetail> {
    // Ownership is enforced by the query, not by comparing ids after the fact.
    return this.accounts.getForCustomer(accountId, customerId);
  }

  @Patch(':accountId')
  async update(
    @CurrentCustomer() customerId: string,
    @Param('accountId') accountId: string,
    @Body(zodBody(updateAccountRequestSchema)) body: UpdateAccountRequest,
  ): Promise<AccountDetail> {
    await this.profile.update(accountId, customerId, body);
    return this.accounts.getForCustomer(accountId, customerId);
  }

  @Post(':accountId/close')
  @Idempotent()
  async close(
    @CurrentCustomer() customerId: string,
    @Param('accountId') accountId: string,
    @Body(zodBody(closeAccountRequestSchema)) body: CloseAccountRequest,
  ): Promise<AccountDetail> {
    return this.closure.close(accountId, customerId, body);
  }

  @Get(':accountId/balances')
  async balances(
    @CurrentCustomer() customerId: string,
    @Param('accountId') accountId: string,
  ): Promise<AccountBalances> {
    const account = await this.accounts.getForCustomer(accountId, customerId);
    return account.balances;
  }

  @Get(':accountId/balance-history')
  async balanceHistory(
    @CurrentCustomer() customerId: string,
    @Param('accountId') accountId: string,
    @Query(zodBody(balanceHistoryQuerySchema))
    query: z.infer<typeof balanceHistoryQuerySchema>,
  ): Promise<BalanceHistory> {
    const account = await this.accounts.getForCustomer(accountId, customerId);
    return this.history.historyFor(account, query);
  }

  @Get(':accountId/holds')
  async holds(
    @CurrentCustomer() customerId: string,
    @Param('accountId') accountId: string,
  ): Promise<Hold[]> {
    // The SDK declares a bare array here, so no envelope.
    await this.accounts.getForCustomer(accountId, customerId);
    return this.accountHolds.holdsFor(accountId);
  }
}
