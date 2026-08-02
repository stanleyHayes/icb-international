import {
  transactionQuerySchema,
  type CursorPage,
  type TransactionDetail,
  type TransactionSummary,
} from '@icb/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { TransactionsService } from './transactions.service.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(transactionQuerySchema))
    query: ReturnType<typeof transactionQuerySchema.parse>,
  ): Promise<CursorPage<TransactionSummary>> {
    return this.transactions.list(customerId, query);
  }

  @Get(':transactionId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionDetail> {
    return this.transactions.detail(customerId, transactionId);
  }
}
