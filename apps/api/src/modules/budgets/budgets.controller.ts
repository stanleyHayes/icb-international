import { putBudgetsRequestSchema, type PutBudgetsRequest } from '@icb/contracts';
import { Body, Controller, Get, Put } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { BudgetsService, type BudgetsOverview } from './budgets.service.js';

/**
 * Category budgets (`/v1/budgets`). PUT replaces the customer's whole set — idempotent by
 * HTTP semantics, so no idempotency key is needed — and both routes answer with the budgets
 * already evaluated against the current simulated month's ledger spend.
 */
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  @Get()
  overview(@CurrentCustomer() customerId: string): Promise<BudgetsOverview> {
    return this.budgets.overview(customerId);
  }

  @Put()
  replace(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(putBudgetsRequestSchema)) body: PutBudgetsRequest,
  ): Promise<BudgetsOverview> {
    return this.budgets.replace(customerId, body.budgets);
  }
}
