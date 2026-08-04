import {
  openTermDepositRequestSchema,
  type BreakDepositQuote,
  type DepositRateBand,
  type OpenTermDepositRequest,
  type TermDeposit,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import {
  updateTermDepositRequestSchema,
  type UpdateTermDepositRequest,
} from './infrastructure/term-deposit.requests.js';
import { TermDepositBreakService } from './term-deposit-break.service.js';
import { TermDepositsService } from './term-deposits.service.js';

/**
 * Term deposits.
 *
 * Breaking one is two calls on purpose: `break-quote` prices it and holds that price, `break`
 * executes the price already shown. The customer never discovers the cost after the fact.
 */
@Controller('savings')
export class TermDepositsController {
  constructor(
    private readonly deposits: TermDepositsService,
    private readonly breaks: TermDepositBreakService,
  ) {}

  /** The published rate card. Defaults to the bank's base currency. */
  @Get('rates')
  rates(@Query('currency') currency?: string): { items: DepositRateBand[] } {
    return { items: this.deposits.rateCard(currency) };
  }

  @Get('deposits')
  async list(@CurrentCustomer() customerId: string): Promise<{ items: TermDeposit[] }> {
    return { items: await this.deposits.list(customerId) };
  }

  @Post('deposits')
  async open(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(openTermDepositRequestSchema)) body: OpenTermDepositRequest,
  ): Promise<TermDeposit> {
    return this.deposits.open(customerId, body);
  }

  @Get('deposits/:depositId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('depositId') depositId: string,
  ): Promise<TermDeposit> {
    return this.deposits.get(customerId, depositId);
  }

  /** Amend the maturity instruction or rollover account — only while the deposit is unmatured. */
  @Patch('deposits/:depositId')
  async update(
    @CurrentCustomer() customerId: string,
    @Param('depositId') depositId: string,
    @Body(zodBody(updateTermDepositRequestSchema)) body: UpdateTermDepositRequest,
  ): Promise<TermDeposit> {
    return this.deposits.updateMaturity(customerId, depositId, body);
  }

  @Get('deposits/:depositId/break-quote')
  async breakQuote(
    @CurrentCustomer() customerId: string,
    @Param('depositId') depositId: string,
  ): Promise<BreakDepositQuote> {
    return this.breaks.quote(customerId, depositId);
  }

  @Post('deposits/:depositId/break')
  @Idempotent()
  @HttpCode(200)
  async breakDeposit(
    @CurrentCustomer() customerId: string,
    @Param('depositId') depositId: string,
  ): Promise<TermDeposit> {
    return this.breaks.execute(customerId, depositId);
  }
}
