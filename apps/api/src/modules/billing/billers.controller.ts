import { billerQuerySchema, type Biller, type CursorPage } from '@icb/contracts';
import { Controller, Get, Query } from '@nestjs/common';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BillersService } from './billers.service.js';

/**
 * The biller directory.
 *
 * Authenticated but not customer-scoped: the directory is the same for everyone, and it is behind
 * the token because who a bank does business with is not something to publish anonymously.
 */
@Controller('billers')
export class BillersController {
  constructor(private readonly billers: BillersService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(billerQuerySchema))
    query: ReturnType<typeof billerQuerySchema.parse>,
  ): Promise<CursorPage<Biller>> {
    return this.billers.list(query);
  }
}
