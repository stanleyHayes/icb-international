import {
  beneficiaryQuerySchema,
  createBeneficiaryRequestSchema,
  updateBeneficiaryRequestSchema,
  type Beneficiary,
  type CursorPage,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { BeneficiariesService } from './beneficiaries.service.js';

/**
 * Every handler takes the customer from the verified token and passes it into the query filter.
 * A path id alone never selects a row here — that is the difference between a payee list and an
 * IDOR.
 */
@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiaries: BeneficiariesService) {}

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(beneficiaryQuerySchema))
    query: ReturnType<typeof beneficiaryQuerySchema.parse>,
  ): Promise<CursorPage<Beneficiary>> {
    return this.beneficiaries.list(customerId, query);
  }

  @Post()
  async create(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createBeneficiaryRequestSchema))
    body: ReturnType<typeof createBeneficiaryRequestSchema.parse>,
  ): Promise<Beneficiary> {
    return this.beneficiaries.create(customerId, body);
  }

  @Get(':beneficiaryId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
  ): Promise<Beneficiary> {
    return this.beneficiaries.get(customerId, beneficiaryId);
  }

  @Patch(':beneficiaryId')
  async update(
    @CurrentCustomer() customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
    @Body(zodBody(updateBeneficiaryRequestSchema))
    body: ReturnType<typeof updateBeneficiaryRequestSchema.parse>,
  ): Promise<Beneficiary> {
    return this.beneficiaries.update(customerId, beneficiaryId, body);
  }

  @Delete(':beneficiaryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentCustomer() customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
  ): Promise<void> {
    await this.beneficiaries.remove(customerId, beneficiaryId);
  }
}
