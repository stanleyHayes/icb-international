import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ContentModule } from '../content/content.module.js';
import { CatalogueSeeder } from './catalogue.seeder.js';
import { ProductDoc, ProductSchema } from './infrastructure/product.schemas.js';
import { PricingService } from './pricing.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsStaffController } from './products-staff.controller.js';
import { ProductsService } from './products.service.js';
import { RatesService } from './rates.service.js';

/**
 * Products & pricing (BE-08).
 *
 * `ProductsService` and `PricingService` are exported because other modules must resolve
 * product configuration here rather than holding their own copy: accounts (BE-10) read
 * eligibility and limits at opening, the interest & fees engine (BE-18) resolves rates and
 * quotes fees, and loans (BE-16) reads the advertised rate band.
 *
 * `ContentModule` is imported so `/products/rates` serves the layered rate table — the
 * catalogue build with content-managed entries over it — from one assembly point.
 */
@Module({
  imports: [
    ContentModule,
    MongooseModule.forFeature([{ name: ProductDoc.name, schema: ProductSchema }]),
  ],
  controllers: [ProductsController, ProductsStaffController],
  providers: [ProductsService, PricingService, RatesService, CatalogueSeeder],
  exports: [ProductsService, PricingService, RatesService, MongooseModule],
})
export class ProductsModule {}
