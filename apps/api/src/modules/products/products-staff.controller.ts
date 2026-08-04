import { isoDateTimeSchema, productSchema, type Product } from '@icb/contracts';
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { MAX_RATE_PERCENT, MIN_RATE_PERCENT, type RateChange } from './domain/rate-schedule.js';
import { PricingService } from './pricing.service.js';
import { ProductsService } from './products.service.js';

const partialProductSchema = productSchema.partial();

const rateChangeRequestSchema = z.object({
  effectiveFrom: isoDateTimeSchema,
  rate: z.number().min(MIN_RATE_PERCENT).max(MAX_RATE_PERCENT),
});

/**
 * Catalogue administration.
 *
 * Separate controller from the customer reads because the audience is separate: these routes
 * are role-gated, they see retired products, and they are the only writes the catalogue
 * accepts. Every mutation carries an audit action (N7).
 */
@Controller('admin/products')
@UseGuards(RolesGuard)
@Roles('operations', 'admin', 'super_admin')
export class ProductsStaffController {
  constructor(
    private readonly products: ProductsService,
    private readonly pricing: PricingService,
  ) {}

  @Get()
  async listAll(): Promise<Product[]> {
    return this.products.listAll();
  }

  @Post()
  @AuditAction('products.create')
  async create(
    @Body(zodBody(productSchema)) body: Product,
  ): Promise<Product> {
    return this.products.create(body);
  }

  @Patch(':productCode')
  @AuditAction('products.update')
  async update(
    @Param('productCode') productCode: string,
    @Body(zodBody(partialProductSchema)) body: Partial<Product>,
  ): Promise<Product> {
    return this.products.update(productCode, body);
  }

  /** The effective-dated schedule the admin console edits against. */
  @Get(':productCode/rates')
  async listRates(@Param('productCode') productCode: string): Promise<RateChange[]> {
    return this.pricing.rateScheduleFor(productCode);
  }

  /** Announce a rate change; it takes effect at `effectiveFrom`, which may be in the future. */
  @Post(':productCode/rates')
  @AuditAction('products.schedule-rate')
  async scheduleRate(
    @Param('productCode') productCode: string,
    @Body(zodBody(rateChangeRequestSchema))
    body: ReturnType<typeof rateChangeRequestSchema.parse>,
  ): Promise<RateChange[]> {
    return this.pricing.addRateChange(productCode, {
      effectiveFrom: new Date(body.effectiveFrom),
      rate: body.rate,
    });
  }
}
