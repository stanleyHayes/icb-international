import {
  bulkTransferRequestSchema,
  cancelTransferRequestSchema,
  createTransferRequestSchema,
  transferQuerySchema,
  transferQuoteRequestSchema,
  type BulkTransferResult,
  type CursorPage,
  type TransferDetail,
  type TransferQuote,
  type TransferSummary,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { BulkTransfersService } from './application/bulk-transfers.service.js';
import { TransferQuotesService } from './application/transfer-quotes.service.js';
import { TransfersService } from './transfers.service.js';

/**
 * Customer money movement.
 *
 * Every mutating route is idempotent (N6): a retried confirm replays the stored response rather
 * than posting twice. Static segments (`quotes`, `bulk`) are declared before the `:transferId`
 * routes so Express-style matching never shadows them.
 */
@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transfers: TransfersService,
    private readonly quotes: TransferQuotesService,
    private readonly bulk: BulkTransfersService,
  ) {}

  @Post('quotes')
  @Idempotent()
  async quote(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(transferQuoteRequestSchema))
    body: ReturnType<typeof transferQuoteRequestSchema.parse>,
  ): Promise<TransferQuote> {
    return this.quotes.issue(customerId, body);
  }

  @Post('bulk')
  @Idempotent()
  async createBulk(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(bulkTransferRequestSchema))
    body: ReturnType<typeof bulkTransferRequestSchema.parse>,
  ): Promise<BulkTransferResult> {
    return this.bulk.execute(customerId, body);
  }

  @Post()
  @Idempotent()
  async create(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createTransferRequestSchema))
    body: ReturnType<typeof createTransferRequestSchema.parse>,
  ): Promise<TransferDetail> {
    return this.transfers.create(customerId, body);
  }

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(transferQuerySchema))
    query: ReturnType<typeof transferQuerySchema.parse>,
  ): Promise<CursorPage<TransferSummary>> {
    return this.transfers.list(customerId, query);
  }

  @Get(':transferId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('transferId') transferId: string,
  ): Promise<TransferDetail> {
    return this.transfers.get(customerId, transferId);
  }

  @Post(':transferId/cancel')
  @Idempotent()
  async cancel(
    @CurrentCustomer() customerId: string,
    @Param('transferId') transferId: string,
    @Body(zodBody(cancelTransferRequestSchema))
    body: ReturnType<typeof cancelTransferRequestSchema.parse>,
  ): Promise<TransferDetail> {
    return this.transfers.cancel(customerId, transferId, body.reason);
  }
}
