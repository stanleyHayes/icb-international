import {
  createTransferTemplateRequestSchema,
  type TransferTemplate,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { TransferTemplatesService } from './application/transfer-templates.service.js';

/** Saved transfer terms, re-runnable in one tap. */
@Controller('transfer-templates')
export class TransferTemplatesController {
  constructor(private readonly templates: TransferTemplatesService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<TransferTemplate[]> {
    return this.templates.list(customerId);
  }

  @Post()
  async create(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createTransferTemplateRequestSchema))
    body: ReturnType<typeof createTransferTemplateRequestSchema.parse>,
  ): Promise<TransferTemplate> {
    return this.templates.create(customerId, body);
  }

  @Delete(':templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentCustomer() customerId: string,
    @Param('templateId') templateId: string,
  ): Promise<void> {
    await this.templates.remove(customerId, templateId);
  }
}
