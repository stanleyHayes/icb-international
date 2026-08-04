import type { Product, RateTable } from '@icb/contracts';
import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator.js';
import { ProductsService } from './products.service.js';
import { RatesService } from './rates.service.js';

/**
 * The customer-facing catalogue, matching `packages/sdk/src/endpoints/products.ts`.
 *
 * Every route here is public, because all of it is marketing material: what the bank sells and
 * on what terms. The marketing site carries no token, and the published contract declares these
 * three `auth: false` — an authenticated catalogue would 401 every visitor and every integrator
 * following the spec.
 *
 * `rates` is declared before `:productCode` so it is never captured as a product code.
 */
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly rates: RatesService,
  ) {}

  @Public()
  @Get()
  async list(): Promise<Product[]> {
    return this.products.list();
  }

  @Public()
  @Get('rates')
  async rateTable(): Promise<RateTable> {
    return this.rates.getRateTable();
  }

  @Public()
  @Get(':productCode')
  async detail(@Param('productCode') productCode: string): Promise<Product> {
    return this.products.getByCode(productCode);
  }
}
