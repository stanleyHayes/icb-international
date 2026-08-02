import { createTransferRequestSchema, type TransferSummary } from '@icb/contracts';
import { Body, Controller, Get, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { TransfersService } from './transfers.service.js';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: TransferSummary[] }> {
    return { items: await this.transfers.listForCustomer(customerId) };
  }

  @Post()
  async create(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createTransferRequestSchema))
    body: ReturnType<typeof createTransferRequestSchema.parse>,
  ): Promise<TransferSummary> {
    return this.transfers.create(customerId, body);
  }
}
