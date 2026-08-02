import {
  customerSearchQuerySchema,
  offsetQuerySchema,
  type CustomerAdminView,
  type OffsetPage,
} from '@icb/contracts';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CustomerDirectoryService } from './customer-directory.service.js';

const searchQuerySchema = customerSearchQuerySchema.extend(offsetQuerySchema.shape);

/** Customer search and the 360° view. Read-only; lifecycle actions live in the customers module. */
@Controller('admin/customers')
@UseGuards(RolesGuard)
@Roles('support', 'operations', 'compliance', 'admin', 'super_admin')
export class CustomerDirectoryController {
  constructor(private readonly directory: CustomerDirectoryService) {}

  @Get()
  async search(
    @Query(new ZodValidationPipe(searchQuerySchema))
    query: ReturnType<typeof searchQuerySchema.parse>,
  ): Promise<OffsetPage<CustomerAdminView>> {
    return this.directory.search(query);
  }

  @Get(':customerId')
  async detail(@Param('customerId') customerId: string): Promise<CustomerAdminView> {
    return this.directory.getById(customerId);
  }
}
