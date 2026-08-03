import type { Product, RateTable } from '@icb/contracts';
import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator.js';
import { ProductsService } from './products.service.js';
import { RatesService } from './rates.service.js';

/**
 * The customer-facing catalogue, matching `packages/sdk/src/endpoints/products.ts`.
 *
 * `GET /products/rates` is the one public route: the marketing site has no token, so it is
 * opted out of the global auth guard and served from a short-TTL cache. It is declared before
 * `:productCode` so "rates" is never captured as a code.
 */
@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly rates: RatesService,
  ) {}

  @Get()
  async list(): Promise<Product[]> {
    return this.products.list();
  }

  @Public()
  @Get('rates')
  async rateTable(): Promise<RateTable> {
    return this.rates.getRateTable();
  }

  @Get(':productCode')
  async detail(@Param('productCode') productCode: string): Promise<Product> {
    return this.products.getByCode(productCode);
  }
}
