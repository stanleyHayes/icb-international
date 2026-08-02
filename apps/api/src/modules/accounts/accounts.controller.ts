import type { AccountDetail, AccountSummary } from '@icb/contracts';
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { z } from 'zod';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { AccountsService } from './accounts.service.js';

const updateNicknameSchema = z.object({ nickname: z.string().max(60).nullable() });

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: AccountSummary[] }> {
    return { items: await this.accounts.listForCustomer(customerId) };
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
    @Body(zodBody(updateNicknameSchema)) body: z.infer<typeof updateNicknameSchema>,
  ): Promise<AccountDetail> {
    await this.accounts.updateNickname(accountId, customerId, body.nickname);
    return this.accounts.getForCustomer(accountId, customerId);
  }
}
